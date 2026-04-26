class PhysioAgent:
    def __init__(self, exercise):
        self.exercise = exercise
        self.state = "READY"
        self.rep_count = 0
        self.last_prompt_time = 0

        # Keyword buckets
        self.ready_words = ["yes", "yeah", "ready", "okay", "ok", "sure", "start"]
        self.posture_words = ["done", "correct", "straight", "ready", "fixed"]
        self.pain_words = [
            "pain", "hurt", "hurting", "ache", "aching",
            "uncomfortable", "discomfort", "burning", "tight"
        ]
        self.stop_words = ["stop", "can't", "cannot", "enough"]

    # ---------------- PROMPTS ----------------
    def get_prompt(self):
        if self.state == "READY":
            return f"Hi! We'll start {self.exercise}. Are you ready?"

        if self.state == "POSTURE":
            return "Please adjust your posture. Keep your back straight. Say 'ready' when done."

        if self.state == "RUNNING":
            return "Great job! Keep going. Tell me immediately if you feel pain."

        if self.state == "STOP":
            return "Please stop now. Sit down and relax. We will pause the session."

        return ""

    # ---------------- INTENT HELPERS ----------------
    def _contains_any(self, text, words):
        return any(word in text for word in words)

    # ---------------- UPDATE LOGIC ----------------
    def update(self, user_input=None, feedback=None, reps=None):
        text = user_input.lower() if user_input else ""

        # ALWAYS detect pain first (highest priority)
        if text and self._contains_any(text, self.pain_words + self.stop_words):
            self.state = "STOP"
            return

        # READY → POSTURE
        if self.state == "READY":
            if text and self._contains_any(text, self.ready_words):
                self.state = "POSTURE"

        # POSTURE → RUNNING
        elif self.state == "POSTURE":
            if text and self._contains_any(text, self.posture_words):
                self.state = "RUNNING"

        # RUNNING → encouragement handled automatically
        elif self.state == "RUNNING":
            pass

        # Update rep count
        if reps is not None:
            self.rep_count = reps
