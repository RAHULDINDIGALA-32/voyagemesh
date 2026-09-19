
import requests

from backend.config import get_settings


class AviationStackClient:
    def __init__(self):
        settings = get_settings()

        self.api_key = settings.aviationstack_key
        self.base_url = settings.aviationstack_base_url
        self.timeout = settings.request_timeout_seconds

        self.session = requests.Session()

    def search(self, params: dict) -> dict:
        request_params = {
            **params,
            "access_key": self.api_key,
        }

        response = self.session.get(
            self.base_url,
            params=request_params,
            timeout=self.timeout,
        )

        response.raise_for_status()
        data = response.json()

        if not isinstance(data, dict):
            raise ValueError("Invalid AviationStack response")

        if data.get("error"):
            raise RuntimeError(
                "AviationStack returned an API error"
            )

        return data