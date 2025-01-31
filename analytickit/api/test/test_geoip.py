from typing import cast
from unittest.mock import Mock

import pytest
from django.contrib.gis.geoip2 import GeoIP2, GeoIP2Exception
from django.test import TestCase

from analytickit.api.geoip import geoip, get_geoip_properties

australia_ip = "13.106.122.3"
uk_ip = "31.28.64.3"
uk_ip_v6 = "2a01:4b00:875f:cf01:109e:dbfd:8cb9:a5d4"
local_ip = "127.0.0.1"


@pytest.mark.parametrize(
    "test_input,expected", [(australia_ip, "Australia"), (uk_ip, "United Kingdom"), (uk_ip_v6, "United Kingdom"), ],
)
def test_geoip_results(test_input, expected):
    properties = get_geoip_properties(test_input)
    assert properties["$geoip_country_name"] == expected
    assert len(properties) == 6


class TestGeoIPDBError(TestCase):
    def setUp(self) -> None:
        self.geoip_city_method = cast(GeoIP2, geoip).city
        geoip.city = Mock(side_effect=GeoIP2Exception("GeoIP file not found"))  # type: ignore

    def tearDown(self) -> None:
        geoip.city = self.geoip_city_method  # type: ignore

    def test_geoip_with_invalid_database_file_returns_successfully(self):
        properties = get_geoip_properties(australia_ip)

        self.assertEqual(properties, {})


class TestGeoIPError(TestCase):
    def test_geoip_on_local_ip_returns_successfully(self):
        properties = get_geoip_properties(local_ip)

        self.assertEqual(properties, {})

    def test_geoip_on_invalid_ip_returns_successfully(self):
        properties = get_geoip_properties(None)

        self.assertEqual(properties, {})
