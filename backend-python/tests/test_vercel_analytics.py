import asyncio
import os
import unittest
from unittest.mock import patch

import httpx

from services.vercel_analytics import get_vercel_web_analytics


class VercelWebAnalyticsTests(unittest.TestCase):
    def test_fetches_monthly_pageviews_and_visitors(self):
        async def run_test():
            requests = []

            async def handler(request):
                requests.append(request)
                return httpx.Response(200, json={"data": {"pageviews": 1200, "visitors": 350}})

            with patch.dict(os.environ, {
                "VERCEL_TOKEN": "vercel-token",
                "VERCEL_PROJECT_ID": "portal72",
                "VERCEL_TEAM_ID": "team-id",
            }, clear=True):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await get_vercel_web_analytics(client)

            self.assertEqual(len(requests), 1)
            request = requests[0]
            self.assertEqual(request.url.path, "/v1/query/web-analytics/visits/count")
            self.assertEqual(request.headers["Authorization"], "Bearer vercel-token")
            self.assertEqual(request.url.params["projectId"], "portal72")
            self.assertEqual(request.url.params["teamId"], "team-id")
            self.assertRegex(request.url.params["since"], r"^\d{4}-\d{2}-01$")
            self.assertEqual(request.url.params["until"], result["updated_at"][:10])
            self.assertEqual(result["status"], "connected")
            self.assertEqual(result["pageviews"], 1200)
            self.assertEqual(result["visitors"], 350)

        asyncio.run(run_test())

    def test_missing_credentials_are_reported_without_request(self):
        async def run_test():
            with patch.dict(os.environ, {}, clear=True):
                async with httpx.AsyncClient() as client:
                    result = await get_vercel_web_analytics(client)

            self.assertEqual(result["status"], "not_configured")
            self.assertIsNone(result["pageviews"])
            self.assertIn("VERCEL_TOKEN", result["message"])

        asyncio.run(run_test())

    def test_vercel_api_errors_are_reported(self):
        async def run_test():
            async def handler(request):
                self.assertEqual(request.method, "GET")
                return httpx.Response(403, json={"error": {"message": "private provider detail"}})

            with patch.dict(os.environ, {
                "VERCEL_TOKEN": "vercel-token",
                "VERCEL_PROJECT_ID": "portal72",
            }, clear=True):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await get_vercel_web_analytics(client)

            self.assertEqual(result["status"], "error")
            self.assertIn("(403)", result["message"])
            self.assertNotIn("private provider detail", result["message"])

        asyncio.run(run_test())

    def test_invalid_analytics_payload_is_reported(self):
        async def run_test():
            async def handler(request):
                self.assertEqual(request.method, "GET")
                return httpx.Response(200, json={"data": {"pageviews": -1, "visitors": 1}})

            with patch.dict(os.environ, {
                "VERCEL_TOKEN": "vercel-token",
                "VERCEL_PROJECT_ID": "portal72",
            }, clear=True):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await get_vercel_web_analytics(client)

            self.assertEqual(result["status"], "error")
            self.assertIsNone(result["pageviews"])

        asyncio.run(run_test())
