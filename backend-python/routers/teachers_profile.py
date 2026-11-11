from fastapi import APIRouter, Header
from schemas.teacher_records import ActivityCreate, AwardCreate, EvaluationCreate, ProfessionalDegreeCreate, ProgramPlanSubmit
from schemas.teachers import TeachingClassesUpdate, TrainingCreate
from services.teacher_auth import require_teacher
from services.teacher_portal import add_evaluation, add_my_activity, add_my_award, add_my_professional_degree, add_my_training, delete_evaluation, delete_my_program_plan, get_my_teacher_data, submit_program_plan, update_my_teaching_classes

router = APIRouter()

@router.get("/me")
def get_my_profile(authorization: str | None = Header(default=None)):
    user = require_teacher(authorization)
    return get_my_teacher_data(user)

@router.put("/me/teaching-classes")
def update_my_classes(
    classes: TeachingClassesUpdate,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    return {"teaching_classes": update_my_teaching_classes(user, classes)}

@router.post("/me/trainings")
def create_my_training(
    training: TrainingCreate,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    return {"training": add_my_training(user, training)}

@router.post("/me/activities")
def create_my_activity(
    activity: ActivityCreate,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    return {"activity": add_my_activity(user, activity)}

@router.post("/me/evaluations")
def create_my_evaluation(
    evaluation: EvaluationCreate,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    return {"evaluation": add_evaluation(user, evaluation)}

@router.delete("/me/evaluations/{evaluation_id}")
def remove_my_evaluation(
    evaluation_id: str,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    delete_evaluation(user, evaluation_id)
    return {"deleted": True}

@router.put("/me/program-plan")
def submit_my_program_plan(
    submission: ProgramPlanSubmit,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    return {"program_plan": submit_program_plan(user, submission)}

@router.delete("/me/program-plan")
def remove_my_program_plan(authorization: str | None = Header(default=None)):
    user = require_teacher(authorization)
    delete_my_program_plan(user)
    return {"deleted": True}

@router.post("/me/awards")
def create_my_award(award: AwardCreate, authorization: str | None = Header(default=None)):
    return {"award": add_my_award(require_teacher(authorization), award)}

@router.post("/me/professional-degrees")
def create_my_professional_degree(degree: ProfessionalDegreeCreate, authorization: str | None = Header(default=None)):
    return {"degree": add_my_professional_degree(require_teacher(authorization), degree)}
