export function validateFHIRResource(resource) {
    const errors = [];

    if (!resource || typeof resource !== "object") {
        return {
            valid: false,
            errors: ["FHIR resource must be a JSON object"]
        };
    }

    if (!resource.resourceType) {
        errors.push("resourceType is required");
    }

    if (
        resource.resourceType &&
        typeof resource.resourceType !== "string"
    ) {
        errors.push("resourceType must be a string");
    }

    if (resource.id !== undefined) {
        if (
            typeof resource.id !== "string" ||
            resource.id.trim() === ""
        ) {
            errors.push("id must be a non-empty string");
        }
    }

    if (resource.subject?.reference) {
        if (!resource.subject.reference.startsWith("Patient/")) {
            errors.push(
                "subject.reference must use Patient/{id} format"
            );
        }
    }

    if (resource.resourceType === "Patient") {
        if (!resource.name) {
            errors.push("Patient.name is required");
        }
    }

    if (resource.resourceType === "Condition") {
        if (!resource.subject?.reference) {
            errors.push("Condition.subject.reference is required");
        }

        if (!resource.code) {
            errors.push("Condition.code is required");
        }
    }

    if (resource.resourceType === "Observation") {
        if (!resource.status) {
            errors.push("Observation.status is required");
        }

        if (!resource.subject?.reference) {
            errors.push(
                "Observation.subject.reference is required"
            );
        }

        if (!resource.code) {
            errors.push("Observation.code is required");
        }
    }

    if (resource.resourceType === "Medication") {
        if (!resource.code) {
            errors.push("Medication.code is required");
        }
    }

    if (resource.resourceType === "AllergyIntolerance") {
        if (!resource.patient?.reference) {
            errors.push(
                "AllergyIntolerance.patient.reference is required"
            );
        }

        if (!resource.code) {
            errors.push("AllergyIntolerance.code is required");
        }
    }

    if (resource.resourceType === "DiagnosticReport") {
        if (!resource.status) {
            errors.push("DiagnosticReport.status is required");
        }

        if (!resource.code) {
            errors.push("DiagnosticReport.code is required");
        }

        if (!resource.subject?.reference) {
            errors.push(
                "DiagnosticReport.subject.reference is required"
            );
        }
    }

    if (resource.resourceType === "Encounter") {
        if (!resource.status) {
            errors.push("Encounter.status is required");
        }

        if (!resource.class) {
            errors.push("Encounter.class is required");
        }

        if (!resource.subject?.reference) {
            errors.push(
                "Encounter.subject.reference is required"
            );
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export function validateFHIRBundle(resources) {
    if (!Array.isArray(resources)) {
        return {
            valid: false,
            errors: ["FHIR resources must be provided as an array"]
        };
    }

    const results = resources.map((resource, index) => {
        const result = validateFHIRResource(resource);

        return {
            index,
            resourceType: resource?.resourceType || null,
            id: resource?.id || null,
            valid: result.valid,
            errors: result.errors
        };
    });

    const invalidResources = results.filter(
        (result) => !result.valid
    );

    return {
        valid: invalidResources.length === 0,
        total: resources.length,
        valid_count:
            resources.length - invalidResources.length,
        invalid_count: invalidResources.length,
        results
    };
}