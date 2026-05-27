/// <reference path="../pb_data/types.d.ts" />

const TempEmail = "_@l.l"; // must be same as in pb_hooks/users.pb.js
migrate((app) => {
  let userEmail = $os.getenv("USER_EMAIL");
  const userPass = $os.getenv("USER_PASS");
  const detailsProvided = userEmail && userPass;

  if (!detailsProvided) userEmail = TempEmail;

  let superusers = app.findCollectionByNameOrId("_superusers");
  let record = new Record(superusers);

  record.setEmail(userEmail);

  if (detailsProvided)
    record.setPassword(userPass);
  else
    record.setRandomPassword();

  app.save(record);

  if (detailsProvided) {
    let usersCollection = app.findCollectionByNameOrId("users");
    let userRecord = new Record(usersCollection);
    userRecord.setEmail(userEmail);
    userRecord.setPassword(userPass);
    userRecord.setVerified(true);
    app.save(userRecord);
  }

  let settings = app.findCollectionByNameOrId("settings");
  record = new Record(settings);
  record.set("key", "server_location");
  record.set("value", "");
  app.save(record);
});