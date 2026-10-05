/* Optional cloud persistence. The game remains usable without configuration. */
(() => {
  "use strict";
  const config = window.MATHS_QUEST_CLOUD || {};
  const bridge = window.mathsQuest;
  const $ = id => document.getElementById(id);
  const configured = Boolean(config.url && config.publishableKey && window.supabase);
  let client, owner = null, revision = null, busy = false, conflict = false;
  let timer, migrationFingerprint = null, pendingUser = null;
  const metaKey = id => `mathsQuestCloudMeta:${id}`;
  const readMeta = id => { try { return JSON.parse(localStorage.getItem(metaKey(id)) || "{}"); } catch (_) { return {}; } };
  const status = message => { $("cloudStatus").textContent = message; };
  const lockUi = locked => { const root = document.querySelector(".wrap"); if (root) root.inert = locked; };
  const metadata = dirty => {
    if (owner) localStorage.setItem(metaKey(owner), JSON.stringify({revision, dirty, migrationFingerprint}));
  };
  function controls() {
    const signedIn = Boolean(owner);
    $("cloudHeading").textContent = signedIn ? "Your parent account" : "Save across devices";
    $("welcomeSaving").textContent = signedIn
      ? "Signed in to your parent account. Profiles and progress save automatically across devices."
      : "No account needed. Create a parent account in Grown-ups to save progress across devices.";
    $("profileSaving").textContent = signedIn
      ? "Your parent account saves profiles and progress privately across devices. Changes save automatically when you’re online."
      : "No account needed. Progress stays on this device. Create a parent account in Grown-ups to save across devices.";
    $("accountSaving").textContent = signedIn
      ? "Profiles, photos, preferences and completed results save automatically. Offline changes stay on this device until they sync. Sign out on shared devices."
      : "Create a parent account with Google to save learner profiles, photos, preferences and completed results privately across devices. Playing without an account is always available.";
    const photoCopy = signedIn
      ? "Photos are resized and saved privately in your parent account, with a copy on this device for offline use."
      : "Photos stay on this device. A parent account can save them privately across devices.";
    $("onboardPhotoSaving").textContent = photoCopy;
    $("avatarPhotoSaving").textContent = photoCopy;
    $("aboutSaving").textContent = signedIn
      ? "You’re signed in to a parent account. Profiles, photos, preferences and completed results save privately across devices; offline changes sync when you reconnect."
      : "No account is needed to play. Guest progress stays on this device; an optional parent account saves profiles, photos, preferences and completed results privately across devices.";

    $("cloudSignIn").hidden = Boolean(owner);
    $("cloudSignedIn").hidden = !owner;
    $("googleSignIn").hidden = !config.providers?.google;
    $("appleSignIn").hidden = !config.providers?.apple;
    $("cloudLoad").hidden = !conflict;
    $("cloudLoad").disabled = busy || bridge.inQuest();
    $("cloudSignOut").disabled = busy || bridge.inQuest();
    $("cloudImportGuest").disabled = busy || bridge.inQuest();
    $("cloudDeleteAccount").disabled = busy || bridge.inQuest();
    $("cloudDeleteAccount").hidden = !config.deleteAccountEnabled;
  }
  function queuedSave() {
    if (!owner) return;
    metadata(true);
    if (!conflict) status(navigator.onLine ? "Changes saved on this device. Saving across devices…" : "Saved on this device. Will sync when you’re online.");
    clearTimeout(timer);
    timer = setTimeout(() => sync(), 1200);
  }
  async function getRemote() {
    const {data, error} = await client.from("family_state")
      .select("revision,payload").eq("owner_id", owner).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function hydrate(payload) {
    const result = structuredClone(payload);
    await Promise.all(result.learners.map(async l => {
      l.photo = "";
      if (!l.photoPath) return;
      const {data, error} = await client.storage.from("profile-photos").download(l.photoPath);
      if (error) throw error;
      l.photo = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(data);
      });
    }));
    return result;
  }
  async function prepare(snapshot) {
    await Promise.all(snapshot.learners.map(async l => {
      if (!l.photo) { delete l.photoPath; return; }
      const blob = await (await fetch(l.photo)).blob();
      if (blob.type !== "image/jpeg" || blob.size > 524288) throw Error("Please choose a smaller profile photo.");
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))]
        .map(n => n.toString(16).padStart(2,"0")).join("");
      const path = `${owner}/${hash}.jpg`;
      // Immutable content-addressed objects avoid changing a photo referenced by
      // another device before the family snapshot transaction succeeds.
      const {error} = await client.storage.from("profile-photos")
        .upload(path, blob, {contentType:"image/jpeg", cacheControl:"0", upsert:false});
      if (error) {
        // A retry may encounter an already-uploaded immutable photo. Verify it
        // by authenticated download instead of depending on an error string.
        const existing = await client.storage.from("profile-photos").download(path);
        if (existing.error) throw error;
      }
      l.photoPath = path;
      delete l.photo;
    }));
    return snapshot;
  }
  async function sync() {
    if (!owner || busy || conflict || bridge.inQuest()) return;
    if (!navigator.onLine) { status("Saved on this device. Will sync when you’re online."); return; }
    busy = true; controls(); status("Saving across devices…");
    const snapshot = bridge.snapshot(), before = JSON.stringify(snapshot);
    try {
      const payload = await prepare(snapshot);
      const {data, error} = await client.rpc("save_family_state", {
        expected_revision:revision, new_payload:payload
      });
      if (error) throw error;
      revision = data;
      const changed = before !== JSON.stringify(bridge.snapshot());
      if (migrationFingerprint) {
        if (JSON.stringify(bridge.cached(null)) === migrationFingerprint) bridge.clearGuest();
        migrationFingerprint = null;
      }
      metadata(changed);
      // Keep unreferenced files for now. Another device may still hold an older
      // snapshot; clean them up during account deletion instead.
      status(changed ? "Saving your latest changes…" : "Saved across devices.");
      if (changed) timer = setTimeout(sync, 1200);
    } catch (error) {
      metadata(true);
      conflict = String(error.message).includes("SAVE_CONFLICT");
      status(conflict
        ? "Another device has a newer save. Your changes are kept on this device. Choose which saved version to use."
        : "Your changes are safe on this device. Cloud saving will retry automatically.");
      console.warn("Cloud save failed", error.message);
    } finally { busy = false; controls(); }
  }
  async function loadLatest() {
    if (busy || bridge.inQuest()) return;
    if (readMeta(owner).dirty && !confirm("Use the latest saved version from another device? This will replace this device’s unsynced changes. Cancel to keep them.")) return;
    busy = true; lockUi(true); controls();
    try {
      const remote = await getRemote();
      if (!remote) throw Error("No saved profiles yet.");
      const payload = await hydrate(remote.payload);
      revision = remote.revision;
      conflict = false; bridge.replace(payload, owner); metadata(false);
      status("Loaded your latest saved profiles.");
    } catch (_) { status("Could not load saved profiles. Your local progress has been kept."); }
    finally { busy = false; lockUi(false); controls(); }
  }
  async function refresh() {
    if (!owner || busy || conflict || bridge.inQuest() || !navigator.onLine) return;
    if (readMeta(owner).dirty) { await sync(); return; }
    busy = true; controls();
    const before = JSON.stringify(bridge.snapshot());
    try {
      const remote = await getRemote();
      if (!remote || remote.revision === revision) return;
      const payload = await hydrate(remote.payload);
      // A parent may edit or start a quest while the download is in flight.
      // Leave those local changes untouched; compare-and-save detects conflicts.
      if (bridge.inQuest() || readMeta(owner).dirty || before !== JSON.stringify(bridge.snapshot())) return;
      revision = remote.revision;
      bridge.replace(payload, owner); metadata(false);
      status("Saved across devices. Profiles are up to date.");
    } catch (_) { /* Cached profiles remain available; retry on the next check. */ }
    finally { busy = false; controls(); }
  }
  async function connect(user) {
    if (owner === user.id) return;
    if (busy || bridge.inQuest()) { pendingUser = user; status("Finish your quest before changing accounts."); return; }
    pendingUser = null;
    busy = true; lockUi(true); controls();
    const oldOwner = bridge.owner();
    try {
      owner = user.id;
      const meta = readMeta(owner), cached = bridge.cached(owner);
      conflict = false; migrationFingerprint = meta.migrationFingerprint || null;
      revision = meta.revision ?? null;
      const remote = await getRemote();
      if (cached && meta.dirty) {
        bridge.replace(cached, owner);
        conflict = (remote?.revision ?? null) !== revision;
        status(conflict ? "Another device has a newer save. Your changes are kept on this device. Choose which saved version to use." : "Your local changes are waiting to sync.");
      } else if (remote) {
        const payload = await hydrate(remote.payload);
        revision = remote.revision;
        bridge.replace(payload, owner); metadata(false);
        status("Your saved profiles are ready. You can also add this device’s guest profiles.");
      } else {
        const guest = bridge.cached(null) || bridge.empty();
        migrationFingerprint = JSON.stringify(bridge.cached(null));
        bridge.replace(guest, owner); metadata(true);
        status("Signed in. Saving this device’s profiles…");
      }
      controls();
    } catch (_) {
      // Never attach guest data to an existing account when its cloud state
      // could not be read. Preserve a same-account cache for offline use.
      const cached = oldOwner === user.id ? bridge.cached(user.id) : null;
      if (cached) bridge.replace(cached, user.id);
      else { owner = null; bridge.replace(bridge.cached(null) || bridge.empty(), null); }
      status("Could not connect to saved profiles. Local progress is available; try signing in again when online.");
    } finally { busy = false; lockUi(false); controls(); }
    if (owner && readMeta(owner).dirty && !conflict) await sync();
  }
  async function signOut(force = false) {
    if (busy || (!force && bridge.inQuest())) return;
    if (!force && readMeta(owner).dirty && !confirm("Some changes have not synced. Cancel to keep them and allow saving to retry. Sign out and remove this device’s account copy?")) return;
    if (force) bridge.endQuest();
    clearTimeout(timer);
    const departing = owner;
    busy = true; lockUi(true); controls();
    try {
      const {error} = await client.auth.signOut({scope:"local"});
      if (error) throw error;
      bridge.clearAccount(departing);
      localStorage.removeItem(metaKey(departing));
      owner = null; revision = null; conflict = false; migrationFingerprint = null;
      bridge.replace(bridge.cached(null) || bridge.empty(), null);
      status("Signed out. Guest use is ready.");
    } catch (_) { status("Could not sign out. Please try again."); }
    finally { busy = false; lockUi(false); controls(); }
  }
  function importGuest() {
    if (busy || !owner || bridge.inQuest()) return;
    const guest = bridge.cached(null);
    if (!guest?.learners?.length) { status("There are no guest profiles to add."); return; }
    if (!confirm("Add this device’s guest profiles to your account as separate learners? Existing saved profiles will stay as they are.")) return;
    const current = bridge.snapshot();
    // Always new IDs: a same-name learner on another device may be different.
    guest.learners.forEach(l => current.learners.push({...l,id:crypto.randomUUID()}));
    bridge.replace(current, owner); migrationFingerprint = JSON.stringify(guest); queuedSave();
    status("Guest profiles added. Saving…");
  }
  async function login(provider) {
    if (busy) return;
    const {error} = await client.auth.signInWithOAuth({provider,
      options:{redirectTo:location.origin + location.pathname}});
    if (error) status("Sign-in could not start. Please try again.");
  }
  async function deleteAccount() {
    if (busy || bridge.inQuest()) return;
    if (!confirm("Permanently delete your parent account, all saved profiles, photos and results? This cannot be undone.")) return;
    busy = true; lockUi(true); controls(); clearTimeout(timer);
    try {
      const {error} = await client.functions.invoke("delete-account", {body:{}});
      if (error) throw error;
      bridge.clearAccount(owner); localStorage.removeItem(metaKey(owner));
      await client.auth.signOut({scope:"local"});
      owner = null; revision = null; conflict = false;
      bridge.replace(bridge.cached(null) || bridge.empty(), null);
      status("Your account and saved data have been deleted.");
    } catch (_) { status("Account deletion could not be completed. Please try again or contact support."); }
    finally { busy = false; lockUi(false); controls(); }
  }
  controls();
  if (!configured) {
    status("Progress is saved on this device. Cross-device saving is being set up.");
    return;
  }
  client = window.supabase.createClient(config.url, config.publishableKey, {
    auth:{flowType:"pkce",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  $("googleSignIn").onclick = () => login("google");
  $("appleSignIn").onclick = () => login("apple");

  $("cloudLoad").onclick = loadLatest;
  $("cloudSignOut").onclick = () => signOut();
  $("cloudImportGuest").onclick = importGuest;
  $("cloudDeleteAccount").onclick = deleteAccount;
  window.addEventListener("mathsquest:changed", () => {
    if (pendingUser && !busy && !bridge.inQuest()) connect(pendingUser);
    else queuedSave();
  });
  window.addEventListener("online", refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  // Also retry failed saves and pick up changes while this device stays open.
  setInterval(refresh, 60000);
  // Defer SDK work outside the auth callback to avoid auth-lock deadlocks.
  client.auth.onAuthStateChange((event, session) => {
    if (session?.user) setTimeout(() => connect(session.user), 0);
    if (event === "SIGNED_OUT" && !busy && owner) setTimeout(() => signOut(true), 0);
  });
  client.auth.getSession().then(({data, error}) => {
    if (error) { status("Sign-in is temporarily unavailable. Your local progress is safe."); return; }
    if (data.session?.user) connect(data.session.user);
    else {
      const cachedOwner = bridge.owner();
      if (cachedOwner) {
        bridge.endQuest(); bridge.clearAccount(cachedOwner); localStorage.removeItem(metaKey(cachedOwner));
        bridge.replace(bridge.cached(null) || bridge.empty(), null);
      }
      status(config.providers?.google || config.providers?.apple
        ? "Save profiles, preferences and completed results across devices. Guest use is always available."
        : "Progress is saved on this device. Google and Apple sign-in are being set up.");
    }
  });
})();
