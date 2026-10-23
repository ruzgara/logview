/// <reference path="../pb_data/types.d.ts" />

// Deletes connections older than PRUNE_CONNECTIONS_HOURS, checked every 10 minutes.
// Disabled unless the env var is set, so normal deployments keep their full history.
cronAdd("prune_connections", "*/10 * * * *", () => {
    const hours = parseInt($os.getenv("PRUNE_CONNECTIONS_HOURS"), 10);
    if (!hours || hours <= 0) {
        return;
    }

    try {
        const result = $app.db()
            .newQuery("DELETE FROM connections WHERE created < strftime('%Y-%m-%d %H:%M:%fZ', 'now', {:offset})")
            .bind({ offset: `-${hours} hours` })
            .execute();
        console.log(`Pruned ${result.rowsAffected()} connections older than ${hours}h`);
    } catch (err) {
        console.log("Prune connections error: " + err.toString());
    }
});
