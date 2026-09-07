import { db } from './index.ts';
import { users, listings, listingAuditLogs } from './schema.ts';
import { eq, desc } from 'drizzle-orm';
import { INITIAL_PROPERTY_LISTINGS } from '../data/initialData.ts';
import { PropertyListing } from '../types.ts';

export interface AuditUserInfo {
  uid?: string;
  name: string;
  email?: string;
}

export async function getOrCreateUser(uid: string, email: string, displayName?: string, photoUrl?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        photoUrl: photoUrl || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || email.split('@')[0],
          photoUrl: photoUrl || null,
          lastLoginAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to sync user to database:', error);
    throw new Error('Failed to register or sync user profile', { cause: error });
  }
}

// Get all listings from Cloud SQL. If empty on initial boot, seed with INITIAL_PROPERTY_LISTINGS
export async function getAllListingsFromDb() {
  try {
    let all = await db.select().from(listings).orderBy(listings.id);
    if (all.length === 0 && INITIAL_PROPERTY_LISTINGS.length > 0) {
      console.log('Seeding initial property listings to Cloud SQL...');
      const toInsert = INITIAL_PROPERTY_LISTINGS.map((item: PropertyListing) => ({
        property: item.property,
        projectCategory: item.projectCategory || 'Project Marketing (PM)',
        location: item.location,
        tenure: item.tenure,
        pm: item.pm,
        availableUnits: item.availableUnits,
        status: item.status,
        date: item.date,
        renewStatus: item.renewStatus,
        notes: item.notes || null,
        updatedByName: 'System Seed',
        updatedByEmail: 'system@internal',
        lastUpdatedAt: new Date(),
      }));

      await db.insert(listings).values(toInsert);
      all = await db.select().from(listings).orderBy(listings.id);
    }

    return all;
  } catch (error) {
    console.error('Database query for listings failed:', error);
    throw new Error('Database query for listings failed', { cause: error });
  }
}

export async function getListingsForUser(uid: string) {
  try {
    return await db
      .select()
      .from(listings)
      .where(eq(listings.updatedByUserId, uid))
      .orderBy(listings.id);
  } catch (error) {
    console.error(`Database query for listings for user ${uid} failed:`, error);
    throw new Error('Database query for user listings failed', { cause: error });
  }
}

// Create new listing with audit attribution
export async function createListingInDb(
  data: {
    property: string;
    projectCategory?: string;
    location: string;
    tenure: string;
    pm: string;
    availableUnits: string;
    status: string;
    date: string;
    renewStatus: string;
    notes?: string;
  },
  userInfo: AuditUserInfo
) {
  try {
    const now = new Date();
    const [inserted] = await db
      .insert(listings)
      .values({
        property: data.property,
        projectCategory: data.projectCategory || 'Project Marketing (PM)',
        location: data.location,
        tenure: data.tenure || '-',
        pm: data.pm || '-',
        availableUnits: data.availableUnits || '-',
        status: data.status || 'Active',
        date: data.date || '',
        renewStatus: data.renewStatus || 'Not Renewed',
        notes: data.notes || null,
        updatedByUserId: userInfo.uid || null,
        updatedByName: userInfo.name || 'Anonymous User',
        updatedByEmail: userInfo.email || null,
        lastUpdatedAt: now,
      })
      .returning();

    // Record audit entry
    await db.insert(listingAuditLogs).values({
      listingId: inserted.id,
      action: 'create',
      changedFields: JSON.stringify({
        property: data.property,
        projectCategory: data.projectCategory || 'Project Marketing (PM)',
        location: data.location,
        status: data.status,
      }),
      userName: userInfo.name || 'Anonymous User',
      userEmail: userInfo.email || null,
      userUid: userInfo.uid || null,
      timestamp: now,
    });

    return inserted;
  } catch (error) {
    console.error('Failed to create listing in database:', error);
    throw new Error('Failed to create listing in database', { cause: error });
  }
}

// Update single listing with audit attribution
export async function updateListingInDb(
  id: number,
  updates: {
    property?: string;
    projectCategory?: string;
    location?: string;
    tenure?: string;
    pm?: string;
    availableUnits?: string;
    status?: string;
    date?: string;
    renewStatus?: string;
    notes?: string;
  },
  userInfo: AuditUserInfo
) {
  try {
    const now = new Date();
    const [updated] = await db
      .update(listings)
      .set({
        ...updates,
        updatedByUserId: userInfo.uid || null,
        updatedByName: userInfo.name || 'Anonymous User',
        updatedByEmail: userInfo.email || null,
        lastUpdatedAt: now,
      })
      .where(eq(listings.id, id))
      .returning();

    // Log the audit action
    await db.insert(listingAuditLogs).values({
      listingId: id,
      action: 'update',
      changedFields: JSON.stringify(updates),
      userName: userInfo.name || 'Anonymous User',
      userEmail: userInfo.email || null,
      userUid: userInfo.uid || null,
      timestamp: now,
    });

    return updated;
  } catch (error) {
    console.error(`Failed to update listing #${id}:`, error);
    throw new Error(`Failed to update listing #${id}`, { cause: error });
  }
}

// Delete listing
export async function deleteListingFromDb(id: number) {
  try {
    await db.delete(listings).where(eq(listings.id, id));
    return { success: true };
  } catch (error) {
    console.error(`Failed to delete listing #${id}:`, error);
    throw new Error(`Failed to delete listing #${id}`, { cause: error });
  }
}

// Fetch audit logs for all listings or a specific listing
export async function getAuditLogs(listingId?: number) {
  try {
    if (listingId) {
      return await db
        .select()
        .from(listingAuditLogs)
        .where(eq(listingAuditLogs.listingId, listingId))
        .orderBy(desc(listingAuditLogs.timestamp))
        .limit(100);
    }

    return await db
      .select()
      .from(listingAuditLogs)
      .orderBy(desc(listingAuditLogs.timestamp))
      .limit(200);
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    throw new Error('Failed to fetch audit logs', { cause: error });
  }
}
