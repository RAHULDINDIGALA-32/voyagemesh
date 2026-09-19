import os
import certifi
from dotenv import load_dotenv

load_dotenv()

from typing import TypedDict, Annotated
import operator
import uuid

import psycopg
from psycopg.rows import dict_row

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langchain_core.messages import (
    AnyMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
)
from langchain_groq import ChatGroq

from tools.tavily import tavily_search
from tools.flight import search_flights


# =========================
# Configuration
# =========================

os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()


DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE URL is not set in the environment (.env)")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("Groq API key is not set in environment (.env)")

LLM_MODEL = "openai/gpt-oss-120b"


# =========================
# LLM
# =========================

llm = ChatGroq(
    model=LLM_MODEL,
    api_key=GROQ_API_KEY,
)

# =========================
# State
# =========================
class TravelState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    user_query: str
    flight_results: str
    hotel_results: str
    itinerary: str
    llm_calls: int


# =========================
# Flight Agent
# =========================

def flight_agent(state: TravelState) -> dict:
    query = state["user_query"]
    flight_results = search_flights(query)

    return {
        "flight_results": flight_results,
        "messages": [
            AIMessage(content="Flight details fetched.")
        ],
        "llm_calls": state.get("llm_calls", 0) + 1
    }


# =========================
# Hotel Agent
# =========================

def hotel_agent(state: TravelState):
    query = f"Best hotels for {state['user_query']}"
    hotel_results = tavily_search(query)

    return {
        "hotel_results": hotel_results,
        "messages": [
            AIMessage(content="Hotels information fetched.")
        ],
        "llm_calls": state.get("llm_calls", 0) + 1
    }


# =========================
# Itinerary Agent
# =========================

def itinerary_agent(state: TravelState):
    system_prompt = "You are an expert travel planner."
    user_prompt = f"""
Create a complete travel itinerary.

User Query:
{state['user_query']}

Flight Results:
{state['flight_results']}

Hotel Results:
{state['hotel_results']}

Make the itinerary practical, budget-aware, and easy to follow.
"""

    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ])

    return {
        "itinerary": response.content,
        "messages": [response],
        "llm_calls": state.get("llm_calls", 0) + 1
    }



# =========================
# Final Response Agent
# =========================

def final_agent(state: TravelState):
    system_prompt = "You are a professional AI travel booking assistant."
    user_prompt = f"""
Generate the final travel response for the user.

User Request:
{state['user_query']}

Flights:
{state['flight_results']}

Hotels:
{state['hotel_results']}

Itinerary:
{state['itinerary']}

Format the final answer beautifully using these sections:

1. Trip Summary
2. Flight Information
3. Hotel Suggestions
4. Day-by-Day Itinerary
5. Estimated Budget
6. Final Recommendations

Important:
- Be clear and practical.
- Mention that live flight API may not provide ticket prices if pricing is unavailable.
- Keep the response useful for real travel planning.
"""

    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ])

    return {
        "messages": [response],
        "llm_calls": state.get("llm_calls", 0) + 1
    }



# =========================
# Build Graph
# =========================

graph_builder = StateGraph(TravelState)

graph_builder.add_node("flight_agent", flight_agent)
graph_builder.add_node("hotel_agent", hotel_agent)
graph_builder.add_node("itinerary_agent", itinerary_agent)
graph_builder.add_node("final_agent", final_agent)

graph_builder.add_edge(START, "flight_agent")
graph_builder.add_edge("flight_agent", "hotel_agent")
graph_builder.add_edge("hotel_agent", "itinerary_agent")
graph_builder.add_edge("itinerary_agent", "final_agent")
graph_builder.add_edge("final_agent", END)


# =========================
# PostgreSQL Checkpointer
# =========================

_conn = psycopg.connect(
    DATABASE_URL,
    autocommit=True,
    row_factory=dict_row
)

checkpointer = PostgresSaver(_conn)
checkpointer.setup()

travel_graph = graph_builder.compile(checkpointer=checkpointer)



# =========================
# Agents Pipeline
# =========================

def run_travel_agent(user_input: str, thread_id: str | None = None):
    if not thread_id:
        thread_id = f"user_{uuid.uuid4().hex}"

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    result = travel_graph.invoke(
        {
            "messages": [
                HumanMessage(content=user_input)
            ],
            "user_query": user_input,
            "flight_results": "",
            "hotel_results": "",
            "itinerary": "",
            "llm_calls": 0
        },
        config=config
    )

    final_answer = result["messages"][-1].content

    return {
        "thread_id": thread_id,
        "answer": final_answer,
        "flight_results": result.get("flight_results", ""),
        "hotel_results": result.get("hotel_results", ""),
        "itinerary": result.get("itinerary", ""),
        "llm_calls": result.get("llm_calls", 0),
    }