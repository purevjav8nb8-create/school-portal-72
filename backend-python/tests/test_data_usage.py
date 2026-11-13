import asyncio
import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import httpx

from services.data_usage import _api_error_detail, _cloudinary, _number, _render, _supabase, _vercel


class DataUsageTests(unittest.TestCase):
    def test_number_parses_numeric_string_values(self):
        self.assertEqual(_number("12.5"), 12.5)
        self.assertEqual(_number(" 4 "), 4.0)
        self.assertIsNone(_number(True))
        self.assertIsNone(_number("not-a-number"))
        self.assertIsNone(_number("Infinity"))

    def test_api_error_detail_extracts_provider_message(self):
        response = httpx.Response(400, json={"error": {"message": "Invalid resource ID"}})
        self.assertEqual(_api_error_detail(response), ": Invalid resource ID")

    def test_render_loads_month_to_date_bandwidth_once_per_day(self):
        async def run_test():
            requests = []

            async def handler(request):
                requests.append(request)
                if request.url.path.endswith("/metrics/memory"):
                    return httpx.Response(200, json=[
                        {
                            "unit": "MB",
                            "values": [
                                {"timestamp": "2026-11-01T00:00:00Z", "value": 256},
                                {"timestamp": "2026-11-02T00:00:00Z", "value": 128},
                            ],
                        },
                    ])
                return httpx.Response(200, json=[
                    {
                        "unit": "GB",
                        "values": [
                            {"timestamp": "2026-11-01T00:00:00Z", "value": 1.25},
                            {"timestamp": "2026-11-02T00:00:00Z", "value": 2.0},
                        ],
                    },
                ])

            with patch.dict(os.environ, {
                "RENDER_API_KEY": "test-key",
                "RENDER_RESOURCE_ID": "srv-test,srv-test-two",
            }):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await _render(client)

            self.assertEqual(result["status"], "connected")
            self.assertEqual(len(requests), 2)
            bandwidth_request = next(request for request in requests if request.url.path.endswith("/metrics/bandwidth"))
            self.assertEqual(bandwidth_request.url.params["resolutionSeconds"], "86400")
            self.assertEqual(bandwidth_request.url.params["resource"], "srv-test,srv-test-two")
            self.assertTrue(bandwidth_request.url.params["startTime"].endswith("Z"))
            self.assertTrue(bandwidth_request.url.params["endTime"].endswith("Z"))
            start = datetime.fromisoformat(bandwidth_request.url.params["startTime"])
            self.assertEqual(start.day, 1)
            self.assertEqual(start.hour, 0)
            bandwidth = next(metric for metric in result["metrics"] if metric["name"] == "Сарын траффик")
            self.assertEqual(bandwidth["total"], 3.25)
            self.assertEqual(bandwidth["limit"], 100.0)
            self.assertEqual(
                [point["value"] for point in bandwidth["points"]],
                [1.25, 3.25],
            )
            self.assertEqual(bandwidth["points"][-1]["value"], 3.25)
            memory = next(metric for metric in result["metrics"] if metric["name"] == "Санах ой")
            self.assertEqual(memory["total"], 128)
            self.assertEqual(
                [point["value"] for point in memory["points"]],
                [256, 128],
            )
            self.assertEqual(memory["limit"], 1024.0)
            self.assertIn("Render Metrics API", result["message"])

        asyncio.run(run_test())

    def test_cloudinary_requests_only_supported_past_dates(self):
        async def run_test():
            requests = []

            async def handler(request):
                requests.append(request)
                return httpx.Response(200, json={
                    "storage": {"usage": 0, "limit": 1_000_000_000},
                    "bandwidth": {"usage": 0, "limit": 1_000_000_000},
                    "transformations": {"usage": 0, "limit": 100},
                })

            with patch.dict(os.environ, {
                "CLOUDINARY_CLOUD_NAME": "test-cloud",
                "CLOUDINARY_API_KEY": "test-key",
                "CLOUDINARY_API_SECRET": "test-secret",
            }):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await _cloudinary(client)

            self.assertEqual(result["status"], "connected")
            dated_requests = [request for request in requests if "date" in request.url.params]
            self.assertEqual(len(dated_requests), 7)
            self.assertTrue(all(
                request.url.params["date"] < datetime.now(timezone.utc).date().isoformat()
                for request in dated_requests
            ))

        asyncio.run(run_test())

    def test_render_invalid_response_returns_error_status(self):
        async def run_test():
            async def handler(_request):
                return httpx.Response(200, json={"unexpected": "shape"})

            with patch.dict(os.environ, {
                "RENDER_API_KEY": "test-key",
                "RENDER_RESOURCE_ID": "srv-test",
            }):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await _render(client)

            self.assertEqual(result["status"], "error")
            self.assertIn("буруу форматтай", result["message"])

        asyncio.run(run_test())

    def test_render_empty_metric_values_return_no_data(self):
        async def run_test():
            async def handler(_request):
                return httpx.Response(200, json=[{"unit": "GB", "values": []}])

            with patch.dict(os.environ, {
                "RENDER_API_KEY": "test-key",
                "RENDER_RESOURCE_ID": "srv-test",
            }):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await _render(client)

            self.assertEqual(result["status"], "no_data")
            self.assertEqual(result["metrics"], [])

        asyncio.run(run_test())

    def test_render_converts_bandwidth_megabytes_to_gigabytes(self):
        async def run_test():
            async def handler(request):
                return httpx.Response(200, json=[{
                    "unit": "MB",
                    "values": [{"timestamp": "2026-11-01T00:00:00Z", "value": 57.03}],
                }])

            with patch.dict(os.environ, {
                "RENDER_API_KEY": "test-key",
                "RENDER_RESOURCE_ID": "srv-test",
            }):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await _render(client)

            bandwidth = next(metric for metric in result["metrics"] if metric["name"] == "Сарын траффик")
            self.assertAlmostEqual(bandwidth["total"], 0.05703)
            self.assertEqual(bandwidth["unit"], "GB")
            self.assertEqual(bandwidth["limit"], 100.0)

        asyncio.run(run_test())

    def test_cloudinary_usage_includes_plan_limit(self):
        async def run_test():
            requests = []

            async def handler(request):
                requests.append(request)
                return httpx.Response(200, json={
                    "credits": {"usage": 8.5, "limit": 25},
                    "storage": {"usage": 2_000_000_000, "limit": 10_000_000_000},
                    "bandwidth": {"usage": 3_000_000_000, "limit": 20_000_000_000},
                    "transformations": {"usage": 4, "limit": 100},
                })

            with patch.dict(os.environ, {
                "CLOUDINARY_CLOUD_NAME": "test-cloud",
                "CLOUDINARY_API_KEY": "test-key",
                "CLOUDINARY_API_SECRET": "test-secret",
            }):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await _cloudinary(client)

            credits = next(metric for metric in result["metrics"] if metric["name"] == "Сарын кредит")
            storage = next(metric for metric in result["metrics"] if metric["name"] == "Хадгалалт")
            self.assertEqual(credits["total"], 8.5)
            self.assertEqual(credits["limit"], 25)
            self.assertEqual(storage["points"][-1]["value"], 2.0)
            self.assertEqual(storage["limit"], 10.0)
            self.assertTrue(any("date" not in request.url.params for request in requests))

        asyncio.run(run_test())

    def test_supabase_database_and_storage_rpc_limits(self):
        async def run_test():
            requests = []

            async def handler(request):
                requests.append(request)
                if request.url.path.endswith("/rpc/get_usage_sizes"):
                    return httpx.Response(200, json={
                        "database_size_mb": 123.5,
                        "storage_size_mb": 256,
                    })
                return httpx.Response(200, json={
                    "result": [{
                        "timestamp": "2026-11-12T00:00:00Z",
                        "total_rest_requests": 4,
                        "total_auth_requests": 10,
                        "total_realtime_requests": 2,
                        "total_storage_requests": 1,
                    }],
                })

            with patch.dict(os.environ, {
                "SUPABASE_ACCESS_TOKEN": "test-management-token",
                "SUPABASE_PROJECT_REF": "project-test",
                "SUPABASE_URL": "https://project-test.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "test-service-key",
            }):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await _supabase(client)

            self.assertEqual(result["status"], "connected")
            database = next(metric for metric in result["metrics"] if metric["name"] == "Өгөгдлийн сан")
            storage = next(metric for metric in result["metrics"] if metric["name"] == "File Storage")
            self.assertEqual(database["total"], 123.5)
            self.assertEqual(database["limit"], 500.0)
            self.assertEqual(storage["total"], 256)
            self.assertEqual(storage["limit"], 1024.0)
            self.assertTrue(any(request.url.path.endswith("/rpc/get_usage_sizes") for request in requests))

        asyncio.run(run_test())

    def test_vercel_project_lookup_connects_without_team_id_or_fake_usage(self):
        async def run_test():
            requests = []

            async def handler(request):
                requests.append(request)
                return httpx.Response(200, json={"id": "prj_test", "name": "portal72"})

            with patch.dict(os.environ, {
                "VERCEL_TOKEN": "test-token",
                "VERCEL_PROJECT_ID": "prj_test",
            }, clear=True):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await _vercel(client)

            self.assertEqual(result["status"], "connected")
            self.assertEqual(result["metrics"], [])
            self.assertIn("bandwidth", result["message"])
            self.assertEqual(requests[0].url.path, "/v9/projects/prj_test")
            self.assertNotIn("teamId", requests[0].url.params)

        asyncio.run(run_test())

    def test_vercel_invalid_project_response_returns_error_status(self):
        async def run_test():
            async def handler(_request):
                return httpx.Response(200, json=[])

            with patch.dict(os.environ, {
                "VERCEL_TOKEN": "test-token",
                "VERCEL_PROJECT_ID": "prj_test",
            }, clear=True):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await _vercel(client)

            self.assertEqual(result["status"], "error")
            self.assertIn("буруу форматтай", result["message"])

        asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main()
