# LOGVIEW

A fancy dashboard for your logs

*Form over function*

Currently, its built to only really work with json access logs from traefik.

To run, use the docker-compose.yml file

There are 2 images: the agent, and the app.

- The agent: uploads logs to the database
    - It requires the log folder to be mounted as a volume (to /log by default), and the log file name provided as LOG_FILE
    - It currently also needs a Pocketbase token as an environment variable (PB_TOKEN). To get one, you must create a superuser account via the link provided by the app at startup, then go to system collections, superusers, click on the one you created, then click on the 3 dots, impersonate, use a long time (eg 31556952 for a year), and copy the token. Then you can start the agent with the PB_TOKEN environment variable

- The app: Includes the backend (pocketbase) and the frontend (react)
    - At startup you must create a default user, then the dashboard will be served at /
    - The backend dashboard can be found at /_/

For test logs, add json logs to test_log_source.log in test/ Then run `python test_log_populator.py`. This will populate ./test/test.log. You can mount ./test/ to the agent, and provide test.log as LOG_FILE

TODO:
- [X] Fix globe streaks not getting removed
- [ ] Fix auth flow
- [ ] Agent improvements