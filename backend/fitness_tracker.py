from flask import Flask, Response, jsonify, request
import cv2
from models.bicep.bicep_processor import process_bicep_frame, get_status
from models.squat.squat_processor import process_squat_frame, get_status as squat_get_status
from models.neck.neck_processor import process_neck, get_status as neck_get_status
from models.leg.leg_processor import process_leg_frame, get_status as leg_status
from flask_cors import CORS
from physio_agent import PhysioAgent

app = Flask(__name__)
CORS(app)

# Single global webcam
cap = cv2.VideoCapture(0)

agent_sessions = {}

# ==========================
# BICEP ROUTES
# ==========================

@app.route("/bicep/live")
def bicep_live():
    def generate():
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
            counters, feedback, overlay = process_bicep_frame(frame)
            _, buffer = cv2.imencode(".jpg", overlay)
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + buffer.tobytes()
                + b"\r\n"
            )
    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/bicep/status")
def bicep_status():
    status = get_status()
    # counters: {"left": N, "right": N}
    # feedback: {"left": "...", "right": "..."}
    # model_feedback: {"left": "correct/partial_motion/...", "right": "..."}
    # Exercise.tsx reads counters + model_feedback to build labelCounts
    return jsonify({
        "counters":       status["counters"],        # {"left": 3, "right": 2}
        "feedback":       status["feedback"],        # {"left": "detected - 72°", ...}
        "model_feedback": status["model_feedback"],  # {"left": "correct", ...}
        "collecting":     status["collecting"],
    })


# ==========================
# SQUAT ROUTES
# ==========================

@app.route("/squat/live")
def squat_live():
    print("[squat/live] 🔴 Endpoint called - starting generator")
    def generate():
        frame_count = 0
        print("[squat/live] 🟢 Generator started, entering loop")
        while True:
            try:
                ret, frame = cap.read()
                frame_count += 1
                if frame_count % 30 == 0:
                    print(f"[squat/live] Frame {frame_count}: ret={ret}, shape={frame.shape if ret else 'None'}")
                if not ret:
                    print("[squat/live] ⚠️ Frame capture failed, retrying...")
                    continue
                counters, feedback, overlay = process_squat_frame(frame)
                success, buffer = cv2.imencode('.jpg', overlay)
                if not success:
                    print("[squat/live] ❌ JPEG encoding failed")
                    continue
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            except Exception as e:
                import traceback
                print(f"[squat/live] 🔥 ERROR: {type(e).__name__}: {e}")
                print(traceback.format_exc())
                continue
    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/squat/status")
def squat_status_route():
    try:
        status = squat_get_status()
        return jsonify({
            "counters":       status.get("counters"),
            "feedback":       status.get("feedback"),
            "model_feedback": status.get("model_feedback"),
            "collecting":     status.get("collecting"),
        })
    except Exception:
        ret, frame = cap.read()
        if not ret:
            return jsonify({"counters": {}, "feedback": {}, "model_feedback": {}, "collecting": False})
        counters, feedback, _ = process_squat_frame(frame)
        return jsonify({"counters": counters, "feedback": feedback, "model_feedback": {}, "collecting": False})


# ==========================
# NECK ROUTES
# ==========================

@app.route("/neck/live")
def neck_live():
    def generate():
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
            counters, feedback, overlay = process_neck_frame(frame)
            _, buffer = cv2.imencode(".jpg", overlay)
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + buffer.tobytes()
                + b"\r\n"
            )
    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/neck/status")
def neck_status():
    status = neck_get_status()
    return jsonify({
        "counters":       status["counters"],
        "feedback":       status["feedback"],
        "model_feedback": status.get("model_feedback", {}),
        "collecting":     status.get("collecting", {}),
    })


# ==========================
# LEG ROUTES
# ==========================

@app.route("/leg/live")
def leg_live():
    def generate():
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            counters, feedback, overlay = process_leg_frame(frame)
            _, buffer = cv2.imencode('.jpg', overlay)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/leg/status")
def status_route():
    return jsonify(leg_status())


# ==========================
# AGENT ROUTES
# ==========================

@app.route("/agent/start", methods=["POST", "GET"])
def start_agent():
    if request.method == "GET":
        return jsonify({"message": "Use POST"}), 405
    data = request.json
    session_id = data["session_id"]
    exercise = data["exercise"]
    agent_sessions[session_id] = PhysioAgent(exercise)
    return jsonify({
        "message": agent_sessions[session_id].get_prompt(),
        "state": "READY"
    })


@app.route("/agent/update", methods=["POST", "GET"])
def update_agent():
    if request.method == "GET":
        return jsonify({"message": "Use POST"}), 405
    data = request.json
    session_id = data["session_id"]
    user_input = data.get("user_input", "")
    agent = agent_sessions.get(session_id)
    if not agent:
        return jsonify({"error": "Session not found"}), 404

    status = get_status()
    reps = status["counters"].get("left", 0) + status["counters"].get("right", 0)
    fb = status["feedback"].get("left", "")

    agent.update(user_input=user_input, feedback=fb, reps=reps)
    return jsonify({
        "message": agent.get_prompt(),
        "state": agent.state,
        "reps": agent.rep_count
    })


# ==========================
# MAIN
# ==========================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 FLASK LIVE TRACKER STARTING")
    print("="*60)
    print(f"📷 Webcam initialized: {cap.isOpened()}")
    print("📍 Routes available:")
    print("   - /bicep/live")
    print("   - /bicep/status")
    print("   - /squat/live")
    print("   - /squat/status")
    print("   - /neck/live")
    print("   - /neck/status")
    print("   - /leg/live")
    print("   - /leg/status")
    print("="*60 + "\n")
    app.run(port=5001, debug=False, use_reloader=False)