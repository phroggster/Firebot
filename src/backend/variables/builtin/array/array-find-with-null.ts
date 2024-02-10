import { ReplaceVariable, Trigger } from "../../../../types/variables";
import { OutputDataType, VariableCategory } from "../../../../shared/variable-constants";

import arrayFindIndex from "./array-find-index";

const model : ReplaceVariable = {
    definition: {
        handle: "arrayFindWithNull",
        usage: "arrayFindWithNull[array, matcher, propertyPath]",
        description: "Finds a matching element in the array or returns a literal null",
        examples: [
            {
                usage: 'arrayFindWithNull["[1,2,3]", 1]',
                description: "Finds 1 in the array"
            },
            {
                usage: 'arrayFindWithNull["[{\\"username\\": \\"ebiggz\\"},{\\"username\\": \\"MageEnclave\\"}]", ebiggz, username]',
                description: 'Finds object with username of "ebiggz"'
            },
            {
                usage: 'arrayFindWithNull[rawArray, value]',
                description: 'Searches each item in the array for "value" and returns the first matched item'
            },
            {
                usage: 'arrayFindWithNull[rawArray, value, key]',
                description: 'Searches each item in the array for an item that has a "key" property that equals "value"'
            }
        ],
        categories: [VariableCategory.ADVANCED],
        possibleDataOutput: [OutputDataType.TEXT, OutputDataType.NUMBER]
    },

    evaluator: (
        trigger: Trigger,
        subject: string | unknown[],
        matcher: unknown,
        propertyPath : string = null
    ) : unknown => {
        if (typeof subject === 'string' || subject instanceof String) {
            try {
                subject = JSON.parse(`${subject}`);
            } catch (ignore) {
                return null;
            }
        }
        if (!Array.isArray(subject)) {
            return null;
        }

        const index = <number>arrayFindIndex.evaluator(trigger, subject, matcher, propertyPath);
        if (index == null) {
            return null;
        }
        return subject[index];
    }
};

export default model;