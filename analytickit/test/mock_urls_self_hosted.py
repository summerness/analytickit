from analytickit.urls import opt_slash_path
from analytickit.views import robots_txt

settings = {"MULTI_TENANCY": False}

urlpatterns = []

if not settings["MULTI_TENANCY"]:
    urlpatterns.append(opt_slash_path("robots.txt", robots_txt))
