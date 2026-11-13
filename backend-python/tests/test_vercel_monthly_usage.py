import asyncio
import json
import os
import re
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException

from services.vercel_monthly_usage import get_vercel_monthly_usage, save_vercel_monthly_usage


class VercelMonthlyUsageTests(unittest.TestCase):
    def test_missing_row_returns_zeroes_for_current_month(self):
        async def run_test():
            async def handler(request):
                self.assertEqual(request.method, "GET")
                self.assertEqual(request.url.params["id"], "eq.1")
                self.assertEqual(request.headers["Authorization"], "Bearer service-key")
                return httpx.Response(200, json=[])

            with patch.dict(os.environ, {
                "SUPABASE_URL": "https://project-test.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "service-key",
            }, clear=True):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await get_vercel_monthly_usage(client)

            self.assertRegex(result["month"], re.compile(r"^\d{4}-(0[1-9]|1[0-2])$"))
            self.assertEqual(result["fast_data_transfer_gb"], 0.0)
            self.assertEqual(result["fast_origin_transfer_gb"], 0.0)
            self.assertEqual(result["cdn_requests"], 0)
            self.assertEqual(result["isr_reads"], 0)
            self.assertIsNone(result["updated_at"])

        asyncio.run(run_test())

    def test_prior_month_record_is_not_carried_forward(self):
        async def run_test():
            async def handler(request):
                self.assertEqual(request.method, "GET")
                return httpx.Response(200, json=[{
                    "month": "2000-01",
                    "fast_data_transfer_gb": 42.5,
                    "fast_origin_transfer_gb": 1.25,
                    "cdn_requests": 1500,
                    "isr_reads": 50,
                    "updated_at": "2000-01-15T12:00:00Z",
                }])

            with patch.dict(os.environ, {
                "SUPABASE_URL": "https://project-test.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "service-key",
            }, clear=True):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await get_vercel_monthly_usage(client)

            self.assertEqual(result["fast_data_transfer_gb"], 0.0)
            self.assertEqual(result["fast_origin_transfer_gb"], 0.0)
            self.assertEqual(result["cdn_requests"], 0)
            self.assertEqual(result["isr_reads"], 0)
            self.assertIsNone(result["updated_at"])

        asyncio.run(run_test())

    def test_save_upserts_single_current_month_row(self):
        async def run_test():
            requests = []

            async def handler(request):
                requests.append(request)
                payload = json.loads(request.content)
                return httpx.Response(201, json=[{
                    **payload,
                    "updated_at": "2026-11-14T12:00:00+00:00",
                }])

            with patch.dict(os.environ, {
                "SUPABASE_URL": "https://project-test.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "service-key",
            }, clear=True):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    result = await save_vercel_monthly_usage(client, {
                        "fast_data_transfer_gb": 45.77,
                        "fast_origin_transfer_gb": 0.89,
                        "cdn_requests": 1400,
                        "isr_reads": 190,
                    })

            self.assertEqual(len(requests), 1)
            self.assertEqual(requests[0].method, "POST")
            self.assertEqual(requests[0].url.params["on_conflict"], "id")
            self.assertIn("resolution=merge-duplicates", requests[0].headers["Prefer"])
            self.assertEqual(result["fast_data_transfer_gb"], 45.77)
            self.assertEqual(result["fast_origin_transfer_gb"], 0.89)
            self.assertEqual(result["cdn_requests"], 1400)
            self.assertEqual(result["isr_reads"], 190)

        asyncio.run(run_test())

    def test_missing_supabase_configuration_is_reported(self):
        async def run_test():
            with patch.dict(os.environ, {}, clear=True):
                async with httpx.AsyncClient() as client:
                    with self.assertRaises(HTTPException) as raised:
                        await get_vercel_monthly_usage(client)
            self.assertEqual(raised.exception.status_code, 503)
            self.assertIn("SUPABASE_SERVICE_ROLE_KEY", raised.exception.detail)

        asyncio.run(run_test())

    def test_missing_table_returns_migration_instructions(self):
        async def run_test():
            async def handler(request):
                self.assertEqual(request.url.path, "/rest/v1/vercel_monthly_usage")
                return httpx.Response(404, json={"code": "PGRST205", "message": "table not found"})

            with patch.dict(os.environ, {
                "SUPABASE_URL": "https://project-test.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "service-key",
            }, clear=True):
                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    with self.assertRaises(HTTPException) as raised:
                        await get_vercel_monthly_usage(client)
            self.assertEqual(raised.exception.status_code, 503)
            self.assertIn("migration-г Supabase дээр ажиллуулна уу", raised.exception.detail)

        asyncio.run(run_test())
