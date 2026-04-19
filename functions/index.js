const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = admin.firestore();
const auth = admin.auth();

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function ensureAuth(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
}

function ensureAdmin(req) {
  ensureAuth(req);
  if (!req.auth.token.admin) {
    throw new HttpsError('permission-denied', 'Admin only');
  }
}

exports.syncUser = onCall(async (req) => {
  ensureAuth(req);
  const uid = req.auth.uid;
  const email = String(req.auth.token.email || '').toLowerCase();
  const displayName = req.auth.token.name || '';
  const photoURL = req.auth.token.picture || '';
  const adminEmails = getAdminEmails();
  const shouldBeAdmin = !!email && adminEmails.includes(email);

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const existing = snap.exists ? snap.data() : {};

  const data = {
    email,
    displayName,
    photoURL,
    lastLoginAt: now,
    updatedAt: now
  };

  if (!snap.exists) {
    data.createdAt = now;
    data.approved = shouldBeAdmin;
    data.role = shouldBeAdmin ? 'admin' : 'user';
  }

  if (shouldBeAdmin && !existing.approved) {
    data.approved = true;
    data.role = 'admin';
    data.approvedAt = now;
  }

  await userRef.set(data, { merge: true });

  const claims = {
    ...(existing.approved ? { approved: true } : {}),
    ...(existing.role === 'admin' ? { admin: true } : {}),
    ...(shouldBeAdmin ? { approved: true, admin: true } : {})
  };

  await auth.setCustomUserClaims(uid, claims);
  logger.info('syncUser completed', { uid, email, claims });
  return { ok: true, claims };
});

exports.setUserApproval = onCall(async (req) => {
  ensureAdmin(req);
  const uid = String(req.data?.uid || '').trim();
  const approved = !!req.data?.approved;
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required');

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'user not found');

  const current = snap.data() || {};
  const nextRole = current.role === 'admin' ? 'admin' : 'user';

  await userRef.set({
    approved,
    role: nextRole,
    approvedAt: approved ? admin.firestore.FieldValue.serverTimestamp() : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const claims = {
    ...(approved ? { approved: true } : {}),
    ...(current.role === 'admin' ? { admin: true } : {})
  };
  await auth.setCustomUserClaims(uid, claims);

  return { ok: true, uid, approved };
});
