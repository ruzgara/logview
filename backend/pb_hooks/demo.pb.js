/// <reference path="../pb_data/types.d.ts" />

// Demo mode: enabled by setting DEMO_USER_EMAIL. Visitors are signed in as that user
// without a password, and that user is read-only (the frontend keeps its changes
// in memory instead). Without the env var, /api/demo returns a null email,
// /api/demo-auth 404s and the write guards do nothing.

routerAdd("GET", "/api/demo", (e) => {
    return e.json(200, { email: $os.getenv("DEMO_USER_EMAIL") || null });
});

routerAdd("POST", "/api/demo-auth", (e) => {
    const email = $os.getenv("DEMO_USER_EMAIL");
    if (!email) {
        throw new NotFoundError();
    }

    let user;
    try {
        user = $app.findAuthRecordByEmail("users", email);
    } catch {
        throw new NotFoundError("Demo user not found.");
    }

    return $apis.recordAuthResponse(e, user, "demo");
});

// Reject record writes by the demo user on every collection
onRecordCreateRequest((e) => {
    const email = $os.getenv("DEMO_USER_EMAIL");
    if (email && e.auth && e.auth.getString("email") === email) {
        throw new ForbiddenError("The demo account is read-only.");
    }
    e.next();
});

onRecordUpdateRequest((e) => {
    const email = $os.getenv("DEMO_USER_EMAIL");
    if (email && e.auth && e.auth.getString("email") === email) {
        throw new ForbiddenError("The demo account is read-only.");
    }
    e.next();
});

onRecordDeleteRequest((e) => {
    const email = $os.getenv("DEMO_USER_EMAIL");
    if (email && e.auth && e.auth.getString("email") === email) {
        throw new ForbiddenError("The demo account is read-only.");
    }
    e.next();
});
