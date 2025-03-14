from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/camera/(?P<client_id>\w+)$', consumers.CameraConsumer.as_asgi()),
]