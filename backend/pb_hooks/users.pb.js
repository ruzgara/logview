/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/create-first-user", (e) => {
    const TempEmail = "_@l.l";

    const totalUsers = $app.countRecords("users");
    if (totalUsers > 0) {
        return e.json(403, { err: "Forbidden: Users already exist." });
    }

    const superusers = $app.findAllRecords("_superusers");
    if (superusers.length !== 1 || superusers[0].getString("email") !== TempEmail) {
        return e.json(403, { err: "Forbidden: Invalid setup state." });
    }

    // 2. Correct request parsing using DynamicModel
    let data = new DynamicModel({
        email: "",
        password: ""
    });

    try {
        e.bindBody(data);
    } catch (err) {
        return e.json(400, { err: "Invalid payload format." });
    }

    if (!data.email || !data.password) {
        return e.json(400, { err: "Email and password are required." });
    }

    try {
        // 3. Wrap DB operations in a transaction for atomicity
        $app.runInTransaction((txApp) => {
            const usersCollection = txApp.findCollectionByNameOrId("users");
            const user = new Record(usersCollection);
            user.setEmail(data.email);
            user.setPassword(data.password);
            user.setVerified(true);
            txApp.save(user);

            const superusersCollection = txApp.findCollectionByNameOrId("_superusers");
            const adminUser = new Record(superusersCollection);
            adminUser.setEmail(data.email);
            adminUser.setPassword(data.password);
            txApp.save(adminUser);

            txApp.delete(superusers[0]);
        });

        return e.json(200, { msg: "User and admin created successfully." });
    } catch (err) {
        return e.json(500, { err: "Failed to create users. Ensure passwords meet minimum requirements." });
    }
});

routerAdd("GET", "/api/is-startup", (e) => {
    return e.json(200, { "isStartup": $app.countRecords("users") === 0 });
})