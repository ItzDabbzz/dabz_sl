
import { db } from "../db";
import {
    fertilityData,
    pregnancyData,
    partnerData,
    settingsData,
} from "../../schemas/fertility-schema";
import { eq, desc } from "drizzle-orm";

// Get all data for a user
export async function getAllFertilityData(userId: string) {
    return {
        fertility: await getFertilityData(userId),
        pregnancy: await getPregnancyData(userId),
        partner: await getPartnerData(userId),
        settings: await getSettingsData(userId),
    };
}

// Sync all data (upsert all tables)
export async function syncFertilityData(userId: string, payload: any) {
    await Promise.all([
        updateFertilityData(userId, payload.fertility),
        updatePregnancyData(userId, payload.pregnancy),
        updatePartnerData(userId, payload.partner),
        updateSettingsData(userId, payload.settings),
    ]);
    return { ok: true };
}

// Fertility
export async function getFertilityData(userId: string) {
    const row = await db
        .select()
        .from(fertilityData)
        .where(eq(fertilityData.avatarKey, userId))
        .orderBy(desc(fertilityData.timestamp))
        .limit(1);
    if (!row[0]) return null;
    return {
        cycle_day: row[0].cycleDay,
        cycle_length: row[0].cycleLength,
        status: row[0].status,
        ovulation_day: row[0].ovulationDay,
        fertile_window: [row[0].fertileWindowStart, row[0].fertileWindowEnd],
        timestamp: row[0].timestamp,
    };
}

export async function updateFertilityData(userId: string, data: any) {
    // Upsert by avatarKey
    await db.insert(fertilityData).values({
        avatarKey: userId,
        cycleDay: data.cycle_day,
        cycleLength: data.cycle_length,
        status: data.status,
        ovulationDay: data.ovulation_day,
        fertileWindowStart: data.fertile_window?.[0],
        fertileWindowEnd: data.fertile_window?.[1],
        timestamp: new Date(),
    });
    return { ok: true };
}

// Pregnancy
export async function getPregnancyData(userId: string) {
    const row = await db
        .select()
        .from(pregnancyData)
        .where(eq(pregnancyData.avatarKey, userId))
        .orderBy(desc(pregnancyData.timestamp))
        .limit(1);
    if (!row[0]) return null;
    return {
        pregnant: row[0].pregnant,
        conception_date: row[0].conceptionDate,
        due_date: row[0].dueDate,
        trimester: row[0].trimester,
        weeks: row[0].weeks,
        timestamp: row[0].timestamp,
    };
}

export async function updatePregnancyData(userId: string, data: any) {
    await db.insert(pregnancyData).values({
        avatarKey: userId,
        pregnant: data.pregnant,
        conceptionDate: data.conception_date ? new Date(data.conception_date) : null,
        dueDate: data.due_date ? new Date(data.due_date) : null,
        trimester: data.trimester,
        weeks: data.weeks,
        timestamp: new Date(),
    });
    return { ok: true };
}

// Partner
export async function getPartnerData(userId: string) {
    const row = await db
        .select()
        .from(partnerData)
        .where(eq(partnerData.avatarKey, userId))
        .orderBy(desc(partnerData.timestamp))
        .limit(1);
    if (!row[0]) return null;
    return {
        linked: row[0].linked,
        partner: row[0].partnerKey,
        shared_data: row[0].sharedData,
        permissions: row[0].permissions,
        timestamp: row[0].timestamp,
    };
}

export async function updatePartnerData(userId: string, data: any) {
    await db.insert(partnerData).values({
        avatarKey: userId,
        linked: data.linked,
        partnerKey: data.partner,
        sharedData: data.shared_data,
        permissions: data.permissions,
        timestamp: new Date(),
    });
    return { ok: true };
}

// Settings
export async function getSettingsData(userId: string) {
    const row = await db
        .select()
        .from(settingsData)
        .where(eq(settingsData.avatarKey, userId))
        .orderBy(desc(settingsData.timestamp))
        .limit(1);
    if (!row[0]) return null;
    return {
        fertility_enabled: row[0].fertilityEnabled,
        cycle_length: row[0].cycleLength,
        privacy_mode: row[0].privacyMode,
        timestamp: row[0].timestamp,
    };
}

export async function updateSettingsData(userId: string, data: any) {
    await db.insert(settingsData).values({
        avatarKey: userId,
        fertilityEnabled: data.fertility_enabled,
        cycleLength: data.cycle_length,
        privacyMode: data.privacy_mode,
        timestamp: new Date(),
    });
    return { ok: true };
}
