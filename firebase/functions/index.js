// Public Cloud Functions entry point. Each module represents an application
// boundary while sharing the same tenant-aware authorization implementation.
Object.assign(exports, require('./customer-operations'));
Object.assign(exports, require('./agent-operations'));
Object.assign(exports, require('./website-ingestion'));
Object.assign(exports, require('./platform-administration'));
Object.assign(exports, require('./notification-delivery'));
Object.assign(exports, require('./gohighlevel-operations'));
Object.assign(exports, require('./gohighlevel-oauth'));
Object.assign(exports, require('./messaging-bridge'));
Object.assign(exports, require('./recording-evidence'));
Object.assign(exports, require('./call-evidence-access'));
Object.assign(exports, require('./recording-analysis'));

Object.assign(exports, require('./staff-management'));

Object.assign(exports, require('./onboarding-delivery'));
