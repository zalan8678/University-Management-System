# C3 Design
## Graded Area
We chose Search to be our graded area. This is because Search is straightforward to refactor.
## C3 Questions
1. How will services access repositories?
   Direct imports: service modules import repository modules directly. We chose this because it is simple to understand. However, it can make future expansion harder since it requires changing more import statements.
2. How will you structure validation?
   Middleware-first validators: validation is composed as reusable middleware functions. We chose this because it allows for easier expansion for the future. However, this requires many imports that may change over time.
3. How will you represent domain errors?
   Custom Error subclasses: throw typed errors (e.g. NotFoundError, ValidationError, TooManyResultsError); callers use try/catch. We chose this because it is easier to determine the type of error an error is. However, every new error requires a different class, requiring more work to get started with a new error type.
4. How will you organize your modules?
   Per-layer: all controllers together, all services together, all repositories together. We chose this to debug areas by group. However, new functionality require changes in multiple areas so it may be clunky to expand on.
## Diagram of Request Flow
Client Request
↓
Route
↓
Validation / parsing middleware
↓
Controller
↓
Service

If something fails:
Service throws domain error
↓
controller forwards error
↓
error-handling middleware maps it to HTTP response

## Before and after
https://github.students.cs.ubc.ca/CPSC310-2025W-T2/project_team006/commit/bc1e425af401b0d579e4eb51ae9e1e11a0ab7c20
## Future Improvements
The other three flows have not been properly updated. Therefore, they must be refactored as well to eliminate technical debt.
