# C3 Design
## Graded Area
We chose Search to be our graded area. This is because Search is straightforward to refactor.
## C3 Questions
1. How will services access repositories?
   Direct imports: service modules import repository modules directly
2. How will you structure validation?
   Middleware-first validators: validation is composed as reusable middleware functions
3. How will you represent domain errors?
   Custom Error subclasses: throw typed errors (e.g. NotFoundError, ValidationError, TooManyResultsError); callers use try/catch
4. How will you organize your modules?
   Per-layer: all controllers together, all services together, all repositories together
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
