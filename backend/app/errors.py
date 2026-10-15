"""Classified integration errors with messages safe to return to clients."""


class IntegrationError(Exception):
    def __init__(
        self,
        code: str,
        public_message: str,
        *,
        status_code: int,
        retryable: bool = False,
    ) -> None:
        super().__init__(public_message)
        self.code = code
        self.public_message = public_message
        self.status_code = status_code
        self.retryable = retryable


class QlooError(IntegrationError):
    pass


class LLMError(IntegrationError):
    pass


class VerificationError(IntegrationError):
    pass
