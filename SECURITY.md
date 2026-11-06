# Security policy

## Supported versions

The `main` branch and the production deployment at [https://voyagemesh.vercel.app/](https://voyagemesh.vercel.app/) are in scope.

## Report a vulnerability

Please **do not** file a public GitHub issue for security problems.

Email the maintainer through the address on [the GitHub profile for RAHULDINDIGALA-32](https://github.com/RAHULDINDIGALA-32) with:

- a description of the issue and its impact
- steps to reproduce, or a proof of concept against a **local** instance
- affected routes, environment variables, or agent desks if known

You should receive an acknowledgement within a few days. Please give us time to patch before any public disclosure.

## Out of scope (unless you found a real bypass)

- Rate limits and Groq/Tavily/AviationStack quota behavior
- Model hallucinations that already fail guardrails or show as “unavailable”
- Missing live fares or hotel inventory (the product does not claim these)

## Please do not

- Attempt to access other users’ conversations or trips on production
- Run destructive load tests against the live API
- Include stolen credentials, traveler PII, or service-role keys in reports
