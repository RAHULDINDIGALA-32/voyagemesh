from __future__ import annotations


class HitlError(Exception):
    code = "hitl_error"
    http_status = 400
    recoverable = False

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class WorkflowNotFound(HitlError):
    code = "workflow_not_found"
    http_status = 404


class NotOwner(HitlError):
    code = "not_owner"
    http_status = 403


class StaleIntervention(HitlError):
    code = "stale_hitl"
    http_status = 409
    recoverable = True


class AlreadyResolved(HitlError):
    code = "already_resolved"
    http_status = 409


class ResumeInProgress(HitlError):
    code = "resume_in_progress"
    http_status = 409
    recoverable = True


class InterventionExpired(HitlError):
    code = "hitl_expired"
    http_status = 410
    recoverable = True


class InvalidResponse(HitlError):
    code = "invalid_decision"
    http_status = 422


class ResumeFailed(HitlError):
    code = "resume_failed"
    http_status = 502
    recoverable = True
