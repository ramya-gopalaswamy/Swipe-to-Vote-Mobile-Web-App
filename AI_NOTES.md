# AI usage notes

## Which parts of the system did Cursor write end-to-end?

Cursor generated much of the initial implementation scaffolding and iteration code for GalaSwipe. This included the React + Vite mobile-first structure, Framer Motion swipe interactions, Express + SQLite backend routes, database setup, results aggregation, polling logic, and parts of the Matches and analytics features. It also helped generate API helpers and documentation drafts such as the README.

However, I directed the architecture and feature scope throughout the project. I decided to use Express + SQLite instead of the recommended Supabase by GPT, because the project only required a locally runnable persistent backend, and SQLite reduced setup complexity while still providing a real client-server architecture. I also chose a lightweight username-based identity system instead of implementing full authentication. I tested each requirement manually and I verified swipe gestures on mobile-sized layouts, confirmed vote persistence through the backend, tested deduplication behavior using repeated votes, and checked that polling, results aggregation, matches, analytics, and undo functionality behaved correctly. I also controlled the project scope by prioritizing stable core functionality.

## Where did you have to push back on, fix, or rewrite Cursor’s output? Give one concrete example.

One major correction involved the mobile layout. Early generated versions used a fixed-height approach that caused overflow and image clipping on the required 390×844 viewport. I changed the layout strategy to use a flexible 100dvh mobile-first structure with adaptive card sizing instead of rigid heights. I also reworked the card composition so outfit titles and descriptions remained readable above the image instead of relying entirely on image overlays.

Another example was identity persistence. The first implementation treated the display name as cosmetic while using a random local session ID. That meant the same username on another browser could not restore progress. I redesigned the flow so usernames map to stable backend session identities through `/api/sessions`, allowing progress restoration across reloads and browsers while still keeping the system lightweight.

## One thing Cursor did better than you expected, and one thing it did worse

Cursor performed especially well at rapidly scaffolding connected frontend/backend functionality. It was useful for generating API routes, SQLite aggregation queries, polling behavior, and React UI structure while keeping the codebase relatively organized. It also helped compare implementation approaches quickly when making architecture decisions under time pressure.

The biggest weakness was that some first-pass solutions were overly confident or too rigid. For example, the original mobile layout assumptions created viewport issues, and some generated designs introduced unnecessary complexity or drifted beyond the project scope. I still needed to review the code carefully, simplify decisions, and validate behavior manually rather than assuming the generated solution was correct.

## If you used other AI tools alongside Cursor, what role did each play?

I used ChatGPT alongside Cursor for higher-level software engineering reasoning, architecture discussions, debugging explanations, prompting strategy, and reviewing how well the project aligned with the assessment rubric. ChatGPT was especially useful for refining prompts before sending them to Cursor, breaking the project into manageable vertical slices, evaluating trade-offs between backend options such as Supabase vs SQLite.

---
