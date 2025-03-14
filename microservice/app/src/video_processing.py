import json
import os
import tempfile
import cv2
from tqdm import tqdm

from app.src.lib.action_classifier import get_classifier
from app.src.lib.pose_estimation import get_pose_estimator
from app.src.lib.tracker import get_tracker
from app.src.lib.utils.config import Config
from app.src.lib.utils.drawer import Drawer
from app.src.lib.utils.utils import convert_to_openpose_skeletons
from app.src.lib.utils.video import Video


def process_video(file):
   # Set up input and output paths
   input_video_path = setup_input_file(file)
   output_video_path = get_output_path()
   
   # Initialize components
   video = Video(input_video_path)
   progress_bar = initialize_progress_bar(video)
   components = initialize_components()
   video_writer = initialize_video_writer(video, output_video_path)
   
   # Process the video
   log_entries = process_frames(video, components, video_writer, progress_bar)
   
   # Clean up and return results
   cleanup(input_video_path, progress_bar, video_writer)
   return output_video_path, json.dumps(log_entries, default=str)

def setup_input_file(file):
   with tempfile.NamedTemporaryFile(delete=False) as tmp_input_file:
       tmp_input_file.write(file.file.read())
       return tmp_input_file.name

def get_output_path():
   root_dir = os.path.dirname(os.path.abspath(__file__))
   return os.path.join(root_dir, "processed_video.mp4")

def initialize_progress_bar(video):
   total_frames = getattr(video, "total_frames", None)
   return tqdm(total=total_frames, desc="Processing video", unit="frame", dynamic_ncols=True)

def initialize_components():
   # Load configuration
   cfg = Config("app/src/configs/infer_trtpose_deepsort_dnn.yaml")
   
   # Initialize modules
   pose_estimator = get_pose_estimator(**cfg.POSE)
   tracker = get_tracker(**cfg.TRACKER)
   action_classifier = get_classifier(**cfg.CLASSIFIER)
   drawer = Drawer()
   
   return {
       'pose_estimator': pose_estimator,
       'tracker': tracker,
       'action_classifier': action_classifier,
       'drawer': drawer,
       'visualization_params': {
           'text_color': 'green',
           'add_blank': False,
           'Mode': 'action',
       }
   }

def initialize_video_writer(video, output_path):
   output_width = int(video.width)
   output_height = int(video.height)
   fourcc = cv2.VideoWriter_fourcc(*"mp4v")
   return cv2.VideoWriter(output_path, fourcc, video.fps, (output_width, output_height))

def process_frames(video, components, video_writer, progress_bar):
   pose_estimator = components['pose_estimator']
   tracker = components['tracker']
   action_classifier = components['action_classifier']
   drawer = components['drawer']
   user_text = components['visualization_params']
   
   log_entries = []
   timestamp_prev = 0
   
   for bgr_frame, timestamp in video:
       # Process frame
       rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
       predictions = process_frame(rgb_frame, pose_estimator, tracker, action_classifier)
       
       # Render and write the frame
       render_image = drawer.render_frame(bgr_frame, predictions, **user_text)
       video_writer.write(render_image)
       
       # Add log entry if needed
       if timestamp - timestamp_prev >= 1:
           log_entry = create_log_entry(predictions, timestamp, video.frame_cnt)
           log_entries.append(log_entry)
           timestamp_prev = timestamp
           
       progress_bar.update(1)
       
   return log_entries

def process_frame(rgb_frame, pose_estimator, tracker, action_classifier):
   # Get pose predictions
   predictions = pose_estimator.predict(rgb_frame, get_bbox=True)
   
   if len(predictions) == 0:
       tracker.increment_ages()
       return []
   
   # Track and classify
   predictions = convert_to_openpose_skeletons(predictions)
   predictions, _ = tracker.predict(rgb_frame, predictions)
   
   if len(predictions) > 0:
       predictions = action_classifier.classify(predictions)
       
   return predictions

def create_log_entry(predictions, timestamp, frame_cnt):
   num_people = len(predictions)
   actions = [p.action for p in predictions if hasattr(p, 'action')]
   if not actions:
       actions = ['']
       
   return {
       "Timestamp": timestamp,
       "Frame": frame_cnt,
       "Num_People": num_people,
       "Actions": actions
   }

def cleanup(input_video_path, progress_bar, video_writer):
   progress_bar.close()
   video_writer.release()
   os.remove(input_video_path)