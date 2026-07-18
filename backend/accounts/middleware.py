from .models import UserAction


class UserActionMiddleware:
    ACTION_BY_METHOD = {
        "POST": UserAction.ActionType.CREATE,
        "PATCH": UserAction.ActionType.EDIT,
        "PUT": UserAction.ActionType.EDIT,
        "DELETE": UserAction.ActionType.DELETE,
    }
    EDIT_POST_ACTIONS = {"adjust-stock", "toggle-status"}
    RESOURCE_LABELS = {
        "animals": "animal",
        "vaccinations": "vaccination record",
        "growth-records": "growth record",
        "health-events": "health event",
        "feed-items": "feed item",
        "sales": "sale",
        "expenses": "expense",
        "partners": "partner",
        "contracts": "contract",
        "invoices": "invoice",
        "loans": "loan",
        "loan-payments": "loan payment",
        "users": "user",
        "farm": "farm profile",
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        self._record_action(request, response)
        return response

    def _record_action(self, request, response):
        action_type = self.ACTION_BY_METHOD.get(request.method)
        user = getattr(request, "user", None)
        if not action_type or response.status_code >= 400:
            return
        if not user or not user.is_authenticated or not getattr(user, "farm_id", None):
            return
        if not request.path.startswith("/api/"):
            return
        if request.path.startswith("/api/user-actions/"):
            return

        segments = [segment for segment in request.path.strip("/").split("/") if segment]
        if segments and segments[0] == "api":
            segments = segments[1:]
        if not segments or segments[0].startswith("auth"):
            return

        resource = segments[0]
        if request.method == "POST" and segments[-1] in self.EDIT_POST_ACTIONS:
            action_type = UserAction.ActionType.EDIT

        label = self.RESOURCE_LABELS.get(resource, resource.replace("-", " "))
        verb = {
            UserAction.ActionType.CREATE: "Created",
            UserAction.ActionType.EDIT: "Edited",
            UserAction.ActionType.DELETE: "Deleted",
        }[action_type]

        UserAction.objects.create(
            farm=user.farm,
            user=user,
            action_type=action_type,
            description=f"{verb} {label}.",
        )
