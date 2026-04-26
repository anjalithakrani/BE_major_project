import pandas as pd
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib

# -------------------------------
# 1. Load & clean dataset
# -------------------------------
df = pd.read_csv("edited.csv")

# Drop NA labels — these are unlabelled reps, not a class
df = df[df["label"] != "NA"].reset_index(drop=True)

# Drop classes with too few samples to be reliable
# (optional — comment out if you want to keep them)
min_samples = 5
class_counts = df["label"].value_counts()
valid_classes = class_counts[class_counts >= min_samples].index
df = df[df["label"].isin(valid_classes)].reset_index(drop=True)

print("Class distribution after cleaning:")
print(df["label"].value_counts())

# -------------------------------
# 2. Split features & label
# -------------------------------
X = df.drop(columns=["label"])
y = df["label"]

le = LabelEncoder()
y_encoded = le.fit_transform(y)

print("\nClasses being trained on:", le.classes_)

# -------------------------------
# 3. Train-test split
# -------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded,
    test_size=0.2,
    random_state=42,
    stratify=y_encoded
)

# -------------------------------
# 4. Hyperparameter tuning with GridSearch
# -------------------------------
pipeline = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", SVC(
        kernel="rbf",
        class_weight="balanced",
        probability=True
    ))
])

param_grid = {
    "clf__C": [0.1, 1, 10, 100],
    "clf__gamma": ["scale", "auto", 0.01, 0.1]
}

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

grid_search = GridSearchCV(
    pipeline,
    param_grid,
    cv=cv,
    scoring="balanced_accuracy",  # better than accuracy for imbalanced classes
    n_jobs=-1,
    verbose=1
)

grid_search.fit(X_train, y_train)

print("\nBest params:", grid_search.best_params_)
print("Best CV balanced accuracy:", grid_search.best_score_)

model = grid_search.best_estimator_

# -------------------------------
# 5. Cross-validation on full training set
# -------------------------------
cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="balanced_accuracy")
print("\nCross-val balanced accuracy scores:", cv_scores)
print("Mean:", cv_scores.mean(), "Std:", cv_scores.std())

# -------------------------------
# 6. Evaluate on held-out test set
# -------------------------------
y_pred = model.predict(X_test)

print("\n===== FINAL TEST RESULTS =====")
print("Test Accuracy:", accuracy_score(y_test, y_pred))
print("\nClassification Report:\n",
      classification_report(
          y_test,
          y_pred,
          labels=range(len(le.classes_)),
          target_names=le.classes_,
          zero_division=0
      ))
print("\nConfusion Matrix:\n", confusion_matrix(y_test, y_pred))

# -------------------------------
# 7. Save
# -------------------------------
joblib.dump(model, "rep_svm_model.pkl")
joblib.dump(le, "label_encoder.pkl")

print("\nModel saved!")