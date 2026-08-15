# Assignment 1 reflection

The breakthrough for me was realising that prompt corrections were too temporary. Early
on, I treated the coding agent as something I could steer by saying "fix this"
whenever a lesson broke or an interaction felt wrong. That worked for the next
output, but it did not make the project safer. The shift was turning repeated
corrections into repository-level constraints: `LessonDefinition` made lessons
additive, the shared rules engine became the authority for Go legality,
regression tests checked failures I did not want to rediscover, and navigation
contracts made Contents Page 2 part of the real reading flow. I stopped relying
on the agent to remember previous corrections and increasingly made the repo
reject recurring regressions.

That changed the developer I want to become. I want to specify boundaries rather
than micromanage generated implementation: domain rules in one place,
presentation in another, and checks that make important claims executable. I
also want to verify generated work before treating it as finished. The
page-turn experiment made that concrete. The more elaborate animation was
technically interesting, but it was not automatically better; simplifying it
made the artefact clearer and more stable. I want to keep that judgement: use
the agent for speed and exploration, but keep responsibility for the shape, evidence,
and restraint of the final work.
