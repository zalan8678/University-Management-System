# C3 Design
## Graded Area
We chose Search to be our graded area. This is as the layout of our v2/search already followed a very similar flow to our goal, making it very straightforward to extract the route, middleware, controller, and service functions into separate files.

## C3 Questions
1. How will services access repositories?
   Direct imports: service modules import repository modules directly. 

   Reason: We chose direct imports because it is easier to understand, and because much of the prexisting code already follows a format very similar to it. 

   Tradeoff: However, direct import can make future expansion harder since it requires changing more import statements, and testing trickier since the model needs to be replicated in testing.

2. How will you structure validation?
   Middleware-first validators: validation is composed as reusable middleware functions.

   Reason: We chose this approach since the structure of v2/search allows us to easily extract the middleware into separate files. This also allows us to follow the request lifecycle, where router precedes middleware which precedes controller, and utilize express's router function. This also allows for easier expansion since the validation logic can be used by other files in the future.

   Tradeoff: As the logic for validation is spread across several different middleware files, it can be tricky to determine the logic and flow of the request from the route or other modules alone.

3. How will you represent domain errors?
   Custom Error subclasses: throw typed errors (e.g. NotFoundError, ValidationError, TooManyResultsError); callers use try/catch. 
   
   Reason: We chose this so it is easier to determine the type of error an error from the name, and formulate an appropriate response in error handling.
   
   Tradeoff: However, this results in new error types requires a different class, which results in more work required for future expansions and may be confusing at large scale.

4. How will you organize your modules?
   Per-layer: all controllers together, all services together, all repositories together. 
   
   Reason: We chose this to easily visualize each component of Search and its position in the request cycle. Since we are only refactoring search, this makes the most sense and allows us to visualize the request cycle the easiest.
   
   Tradeoff: However, new functionality require changes in multiple areas so it may be clunky to expand on. Also to understand a feature, one needs to look through multiple files.

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
