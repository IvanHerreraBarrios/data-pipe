exports.handler = async (event) => {
    // Auto-confirma al usuario sin enviar código
    event.response.autoConfirmUser = true;

    // Si Cognito requiere que el email esté verificado, lo marcamos como tal
    if (event.request.userAttributes.email) {
        event.response.autoVerifyEmail = true;
    }

    return event;
};