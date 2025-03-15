from django.urls import re_path
from . import consumers

re_path(r'^ws/camera/(?P<model_name>\w+)$', consumers.CameraConsumer.as_asgi())