export var CallType;
(function (CallType) {
    CallType["CALL"] = "0x00";
    CallType["BATCH_CALL"] = "0x01";
    CallType["DELEGATE_CALL"] = "0xff";
})(CallType || (CallType = {}));
export var ParamCondition;
(function (ParamCondition) {
    ParamCondition[ParamCondition["EQUAL"] = 0] = "EQUAL";
    ParamCondition[ParamCondition["GREATER_THAN"] = 1] = "GREATER_THAN";
    ParamCondition[ParamCondition["LESS_THAN"] = 2] = "LESS_THAN";
    ParamCondition[ParamCondition["GREATER_THAN_OR_EQUAL"] = 3] = "GREATER_THAN_OR_EQUAL";
    ParamCondition[ParamCondition["LESS_THAN_OR_EQUAL"] = 4] = "LESS_THAN_OR_EQUAL";
    ParamCondition[ParamCondition["NOT_EQUAL"] = 5] = "NOT_EQUAL";
    ParamCondition[ParamCondition["ONE_OF"] = 6] = "ONE_OF";
})(ParamCondition || (ParamCondition = {}));
//# sourceMappingURL=types.js.map