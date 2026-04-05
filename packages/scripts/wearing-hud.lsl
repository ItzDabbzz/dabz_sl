integer DEBUG = FALSE;

string API_URL = "https://sl.sanctumrp.net/api/sl/wearing";
string VIEW_URL = "https://sl.sanctumrp.net/wearing";
integer HUD_LINK = 2;
integer MEDIA_FACE = 3;
integer BUTTON_LINK = 1;
integer MEDIA_WIDTH = 512;
integer MEDIA_HEIGHT = 512;
integer AUTO_PLAY = TRUE;
integer SHOW_CONTROLS = PRIM_MEDIA_CONTROLS_MINI;

float SCAN_RADIUS = 20.0;
integer DIALOG_CHAN = -902341;
integer gListen = 0;
list gLabelKeyPairs = [];
key gTarget = NULL_KEY;
integer gResolvedFace = -1;


float gTouchStartTime = 0.0;
float HOLD_DURATION = 1.0; 


string gSessionId = "";
list gPendingItems = [];
integer gItemsSent = 0;
integer gTotalItems = 0;
key gCurrentRequest = NULL_KEY;
integer gRequestType = 0; 
list gCreatorNameCache = [];
list gCreatorNameReqs = [];
integer gCreatorPending = 0;


integer MAX_CACHE_SIZE = 20;
integer MAX_PENDING_REQUESTS = 5;
float MIN_UPDATE_INTERVAL = 1.0;
float gLastUpdateTime = 0.0;
vector HUD_HIDDEN_OFFSET = <0.0, 0.0, -1.0>;
vector gHudShownPos = ZERO_VECTOR;
integer gHudPosCaptured = FALSE;
integer CREATOR_WAIT_MAX_CYCLES = 8;
integer gCreatorWaitCycles = 0;


string json_escape(string s) {
    s = llDumpList2String(llParseString2List(s, ["\\"], []), "\\\\");
    s = llDumpList2String(llParseString2List(s, ["\""], []), "\\\"");
    return s;
}


string get_creator_name_cached(key creator) {
    integer idx = llListFindList(gCreatorNameCache, [(string)creator]);
    if (idx != -1 && idx + 1 < llGetListLength(gCreatorNameCache)) {
        return llList2String(gCreatorNameCache, idx + 1);
    }
    return "";
}


string get_agent_label(key agent) {
    string displayName = llGetDisplayName(agent);
    if (displayName != "") {
        return displayName;
    }

    string legacyName = llKey2Name(agent);
    if (legacyName != "") {
        return legacyName;
    }

    return (string)agent;
}


string get_attach_point_name(integer point) {
    if (point == 0) return "None";
    if (point == 1) return "Chest";
    if (point == 2) return "Skull";
    if (point == 3) return "Left Shoulder";
    if (point == 4) return "Right Shoulder";
    if (point == 5) return "Left Hand";
    if (point == 6) return "Right Hand";
    if (point == 7) return "Left Foot";
    if (point == 8) return "Right Foot";
    if (point == 9) return "Spine";
    if (point == 10) return "Pelvis";
    if (point == 11) return "Mouth";
    if (point == 12) return "Chin";
    if (point == 13) return "Left Ear";
    if (point == 14) return "Right Ear";
    if (point == 15) return "Left Eye";
    if (point == 16) return "Right Eye";
    if (point == 17) return "Nose";
    if (point == 18) return "Right Upper Arm";
    if (point == 19) return "Right Lower Arm";
    if (point == 20) return "Left Upper Arm";
    if (point == 21) return "Left Lower Arm";
    if (point == 22) return "Right Hip";
    if (point == 23) return "Right Upper Leg";
    if (point == 24) return "Right Lower Leg";
    if (point == 25) return "Left Hip";
    if (point == 26) return "Left Upper Leg";
    if (point == 27) return "Left Lower Leg";
    if (point == 28) return "Stomach";
    if (point == 29) return "Left Pec";
    if (point == 30) return "Right Pec";
    if (point == 31) return "HUD Center 2";
    if (point == 32) return "HUD Top Right";
    if (point == 33) return "HUD Top";
    if (point == 34) return "HUD Top Left";
    if (point == 35) return "HUD Center";
    if (point == 36) return "HUD Bottom Left";
    if (point == 37) return "HUD Bottom";
    if (point == 38) return "HUD Bottom Right";
    if (point == 39) return "Neck";
    if (point == 40) return "Avatar Center";
    if (point == 41) return "Left Ring Finger";
    if (point == 42) return "Right Ring Finger";
    if (point == 43) return "Tail Base";
    if (point == 44) return "Tail Tip";
    if (point == 45) return "Left Wing";
    if (point == 46) return "Right Wing";
    if (point == 47) return "Jaw";
    if (point == 48) return "Alt Left Ear";
    if (point == 49) return "Alt Right Ear";
    if (point == 50) return "Alt Left Eye";
    if (point == 51) return "Alt Right Eye";
    if (point == 52) return "Tongue";
    if (point == 53) return "Groin";
    if (point == 54) return "Left Hind Foot";
    if (point == 55) return "Right Hind Foot";
    return "Unknown (" + (string)point + ")";
}


fetch_creator_names_for(key agent) {
    if (agent == NULL_KEY) return;
    if (gCreatorPending >= MAX_PENDING_REQUESTS) return;

    list att = llGetAttachedList(agent);
    integer count = llGetListLength(att);
    if (count == 0) return;

    integer i;
    integer requestCount = 0;

    for (i = 0; i < count && requestCount < MAX_PENDING_REQUESTS; ++i) {
        key k = llList2Key(att, i);
        if (k == NULL_KEY) jump cont;

        key creator = llList2Key(llGetObjectDetails(k, [OBJECT_CREATOR]), 0);
        if (creator == NULL_KEY) jump cont;
        if (get_creator_name_cached(creator) != "") jump cont;

        integer idx = llListFindList(gCreatorNameReqs, [(string)creator]);
        if (idx != -1) jump cont;

        key req = llRequestAgentData(creator, DATA_NAME);
        if (req != NULL_KEY) {
            gCreatorNameReqs += [(string)req, (string)creator];
            gCreatorPending++;
            requestCount++;
        }

        @cont;
    }
}


list calculate_metadata(key agent) {
    list att = llGetAttachedList(agent);
    list usedPoints = [];
    list sharedPoints = [];
    integer i;

    for (i = 0; i < llGetListLength(att); ++i) {
        key k = llList2Key(att, i);
        list d = llGetObjectDetails(k, [OBJECT_ATTACHED_POINT]);
        if (llGetListLength(d) < 1) jump cont;

        integer point = llList2Integer(d, 0);

        integer idx = llListFindList(usedPoints, [point]);
        if (idx != -1) {
            if (llListFindList(sharedPoints, [point]) == -1) {
                sharedPoints += [point];
            }
        } else {
            usedPoints += [point];
        }
        @cont;
    }
    integer freeSlots = 38 - llGetListLength(usedPoints);

    return [freeSlots, llList2CSV(sharedPoints)];
}


update_for(key agent) {
    if (agent == NULL_KEY) return;

    if (gCurrentRequest != NULL_KEY) {
        if (DEBUG) llOwnerSay("DEBUG: Already sending, skipping update");
        return;
    }

    float now = llGetTime();
    if ((now - gLastUpdateTime) < MIN_UPDATE_INTERVAL) {
        return;
    }
    gLastUpdateTime = now;

    gCreatorNameReqs = [];
    gCreatorPending = 0;
    gCreatorWaitCycles = 0;

    fetch_creator_names_for(agent);

    llSetLinkPrimitiveParamsFast(BUTTON_LINK, [PRIM_TEXT, "What They Wearin'\nLoading names...", <1,1,0>, 0.5]);
    llSetTimerEvent(0.5); 
}


store_creator_name(key creator, string name) {
    integer idx = llListFindList(gCreatorNameCache, [(string)creator]);
    if (idx != -1) {
        gCreatorNameCache = llListReplaceList(gCreatorNameCache, [name], idx + 1, idx + 1);
    } else {
        if (llGetListLength(gCreatorNameCache) >= MAX_CACHE_SIZE * 2) {
            gCreatorNameCache = llDeleteSubList(gCreatorNameCache, 0, 1);
        }
        gCreatorNameCache += [(string)creator, name];
    }
}


show_menu() {
    list nearby = llGetAgentList(AGENT_LIST_REGION, []);
    vector myPos = llGetPos();
    list filtered = [];
    gLabelKeyPairs = [];

    integer i;
    for (i = 0; i < llGetListLength(nearby); ++i) {
        key agent = llList2Key(nearby, i);
        vector pos = llList2Vector(llGetObjectDetails(agent, [OBJECT_POS]), 0);
        if (llVecDist(myPos, pos) <= SCAN_RADIUS) {
            string name = llKey2Name(agent);
            if (name != "") {
                filtered += [name];
                gLabelKeyPairs += [name, (string)agent];
            }
        }
    }

    if (llGetListLength(filtered) == 0) {
        llOwnerSay("No avatars found within " + (string)((integer)SCAN_RADIUS) + "m.");
        return;
    }

    if (gListen != 0) llListenRemove(gListen);
    gListen = llListen(DIALOG_CHAN, "", llGetOwner(), "");

    llDialog(llGetOwner(), "Select an avatar:", filtered, DIALOG_CHAN);
}


set_media_url(string url) {
    if (url == "") {
        llOwnerSay("Error: Media URL is empty.");
        return;
    }
    if (gResolvedFace == -1) {
        integer sides = llGetLinkNumberOfSides(HUD_LINK);
        if (sides == 0) {
            llOwnerSay("Error: Unable to determine HUD media face count.");
            return;
        }
        gResolvedFace = MEDIA_FACE;
        if (gResolvedFace < 0 || gResolvedFace >= sides) {
            llOwnerSay("Warning: Configured media face is out of range. Using face 0.");
            gResolvedFace = 0;
        }
    }

    integer result = llSetLinkMedia(HUD_LINK, gResolvedFace, [
        PRIM_MEDIA_AUTO_PLAY, AUTO_PLAY,
        PRIM_MEDIA_CURRENT_URL, url,
        PRIM_MEDIA_HOME_URL, url,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_CONTROLS, SHOW_CONTROLS,
        PRIM_MEDIA_WIDTH_PIXELS, MEDIA_WIDTH,
        PRIM_MEDIA_HEIGHT_PIXELS, MEDIA_HEIGHT
    ]);

    if (result == 0) {
        if (DEBUG) llOwnerSay("Media URL set: " + url);
    } else {
        llOwnerSay("Error: Failed to configure media (code " + (string)result + ").");
    }
}


set_hud_visible(integer visible) {
    float alpha = 0.0;
    if (visible != 0) alpha = 1.0;

    
    if (gResolvedFace == -1) {
        integer sides = llGetLinkNumberOfSides(HUD_LINK);
        if (sides == 0) {
            llOwnerSay("Error: Unable to determine HUD media face for visibility update.");
            return;
        }
        gResolvedFace = MEDIA_FACE;
        if (gResolvedFace < 0 || gResolvedFace >= sides) {
            llOwnerSay("Warning: Configured media face is out of range. Using face 0.");
            gResolvedFace = 0;
        }
    }

    if (!gHudPosCaptured) {
        list posInfo = llGetLinkPrimitiveParams(HUD_LINK, [PRIM_POS_LOCAL]);
        if (llGetListLength(posInfo) > 0) {
            gHudShownPos = llList2Vector(posInfo, 0);
            gHudPosCaptured = TRUE;
        }
    }

    vector targetPos = gHudShownPos;
    if (visible == 0) {
        targetPos = gHudShownPos + HUD_HIDDEN_OFFSET;
    }

    llSetLinkPrimitiveParamsFast(HUD_LINK, [
        PRIM_POS_LOCAL, targetPos,
        PRIM_TEXT, "", <1,1,1>, 0.0
    ]);

    llSetLinkAlpha(HUD_LINK, alpha, gResolvedFace);
}


send_item_to_api(string itemJson, integer isComplete) {
    string body = "{";
    if (gSessionId != "") {
        body += "\"sessionId\":\"" + gSessionId + "\",";
    }
    body += "\"item\":" + itemJson;
    body += ",\"complete\":" + (string)isComplete;

    if (isComplete && gTarget != NULL_KEY) {
        list meta = calculate_metadata(gTarget);
        integer freeSlots = llList2Integer(meta, 0);
        string sharedCsv = llList2String(meta, 1);

        body += ",\"metadata\":{";
        body += "\"freeSlots\":" + (string)freeSlots;
        if (sharedCsv != "") {
            body += ",\"sharedPoints\":[" + sharedCsv + "]";
        }
        body += "}";
    }

    body += "}";

    if (DEBUG) {
        llOwnerSay("DEBUG: Sending POST to: " + API_URL);
        llOwnerSay("DEBUG: Request body length: " + (string)llStringLength(body));
        llOwnerSay("DEBUG: Body preview: " + llGetSubString(body, 0, 200));
    }

    gCurrentRequest = llHTTPRequest(API_URL, [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_BODY_MAXLENGTH, 16384,
        HTTP_VERIFY_CERT, TRUE
    ], body);

    if (DEBUG) {
        llOwnerSay("DEBUG: Request ID: " + (string)gCurrentRequest);
    }
    gRequestType = 1; 
}


process_next_item() {
    if (llGetListLength(gPendingItems) == 0) {
        
        if (gItemsSent > 0) {
            set_media_url(VIEW_URL + "?session=" + gSessionId);
            set_hud_visible(1); 
            llSetLinkPrimitiveParamsFast(BUTTON_LINK, [PRIM_TEXT, "What They Wearin'\n" + (string)gItemsSent + " items", <1,1,1>, 0.5]);
        }
        return;
    }

    
    string itemJson = llList2String(gPendingItems, 0);
    gPendingItems = llDeleteSubList(gPendingItems, 0, 0);

    integer isComplete = (llGetListLength(gPendingItems) == 0);
    send_item_to_api(itemJson, isComplete);
}


string json_item(string name, key creator, integer point) {
    string json = "{";
    json += "\"name\":\"" + json_escape(name) + "\"";
    json += ",\"creator\":\"" + (string)creator + "\"";
    json += ",\"point\":" + (string)point;
    json += ",\"pointName\":\"" + json_escape(get_attach_point_name(point)) + "\"";

    string creatorName = get_creator_name_cached(creator);
    string creatorLabel = creatorName;
    if (creatorLabel == "") {
        creatorLabel = (string)creator;
    }

    json += ",\"creatorName\":\"" + json_escape(creatorLabel) + "\"";

    string profile = "secondlife:///app/agent/" + (string)creator + "/about";
    json += ",\"profileUrl\":\"" + json_escape(profile) + "\"";

    if (creatorName != "") {
        string mp = "https://marketplace.secondlife.com/en-US/products/search?utf8=%E2%9C%93&search%5Bkeywords%5D=" + llEscapeURL(creatorName) + "&search%5Bcategory_id%5D=&search%5Bmaturity_level%5D=GMA";
        json += ",\"mpSearch\":\"" + json_escape(mp) + "\"";
    }

    json += "}";
    return json;
}


list collect_items_for(key agent) {
    if (agent == NULL_KEY) return [];

    list att = llGetAttachedList(agent);
    if (llGetListLength(att) == 0) return [];

    list items = [];
    integer i;

    for (i = 0; i < llGetListLength(att); ++i) {
        key k = llList2Key(att, i);
        if (k == NULL_KEY) jump continue_loop;

        list d = llGetObjectDetails(k, [OBJECT_NAME, OBJECT_CREATOR, OBJECT_ATTACHED_POINT]);
        if (llGetListLength(d) < 3) jump continue_loop;

        string name = llList2String(d, 0);
        key creator = llList2Key(d, 1);
        integer point = llList2Integer(d, 2);

        string itemJson = json_item(name, creator, point);
        items += [itemJson];

        @continue_loop;
    }

    return items;
}

default {
    state_entry() {
        llOwnerSay("What They Wearin' HUD is ready.");
        llOwnerSay("Tap to scan. Press and hold for 1 second to toggle HUD visibility.");
        set_media_url(VIEW_URL);
        llSetLinkPrimitiveParamsFast(HUD_LINK, [PRIM_TEXT, "", <1,1,1>, 0.0]);
        set_hud_visible(0); 
        llSetLinkPrimitiveParamsFast(BUTTON_LINK, [PRIM_TEXT, "What They Wearin'\nTouch to scan", <1,1,1>, 0.5]);
    }

    touch_start(integer num) {
        if (llDetectedKey(0) != llGetOwner()) return;
        if (llDetectedLinkNumber(0) == BUTTON_LINK) {
            gTouchStartTime = llGetTime();
        }
    }

    touch_end(integer num) {
        if (llDetectedKey(0) != llGetOwner()) return;
        if (llDetectedLinkNumber(0) == BUTTON_LINK) {
            float touchDuration = llGetTime() - gTouchStartTime;

            if (touchDuration >= HOLD_DURATION) {
                
                integer currentAlpha = (integer)llList2Float(llGetLinkPrimitiveParams(HUD_LINK, [PRIM_COLOR, gResolvedFace]), 1);
                if (currentAlpha > 0) {
                    set_hud_visible(0);
                    llOwnerSay("HUD media hidden.");
                } else {
                    set_hud_visible(1);
                    llOwnerSay("HUD media shown.");
                }
            } else {
                
                show_menu();
            }
        }
    }

    listen(integer chan, string name, key id, string msg) {
        integer idx = llListFindList(gLabelKeyPairs, [msg]);
        if (idx == -1) return;

        if (idx + 1 < llGetListLength(gLabelKeyPairs)) {
            key agent = (key)llList2String(gLabelKeyPairs, idx + 1);
            gTarget = agent;
            llOwnerSay("Selected avatar: " + get_agent_label(agent));
            set_hud_visible(0); 
            update_for(agent);
        }
    }

    dataserver(key qid, string data) {
        integer idx = llListFindList(gCreatorNameReqs, [(string)qid]);
        if (idx != -1 && idx + 1 < llGetListLength(gCreatorNameReqs)) {
            key creator = (key)llList2String(gCreatorNameReqs, idx + 1);
            store_creator_name(creator, data);
            gCreatorNameReqs = llDeleteSubList(gCreatorNameReqs, idx, idx + 1);
            gCreatorPending--;
            if (gCreatorPending < 0) gCreatorPending = 0;

            if (gTarget != NULL_KEY) {
                fetch_creator_names_for(gTarget);
            }
            if (DEBUG) llOwnerSay("DEBUG: Cached creator name: " + data);

            
        }
    }

    http_response(key req, integer status, list meta, string body) {
        if (req != gCurrentRequest) {
            if (DEBUG) {
                llOwnerSay("DEBUG: Ignoring response - req: " + (string)req);
                llOwnerSay("DEBUG: Expected gCurrentRequest: " + (string)gCurrentRequest);
            }
            return;
        }

        if (DEBUG) {
            llOwnerSay("=== HTTP RESPONSE ===");
            llOwnerSay("DEBUG: Status Code: " + (string)status);
            llOwnerSay("DEBUG: Request ID: " + (string)req);
            llOwnerSay("DEBUG: Response Body: " + llGetSubString(body, 0, 300));
            llOwnerSay("DEBUG: Body Length: " + (string)llStringLength(body));
            llOwnerSay("===================");
        }

        
        gCurrentRequest = NULL_KEY;
        meta = [];

        if (status == 200) {
            
            if (gSessionId == "") {
                integer sidx = llSubStringIndex(body, "\"sessionId\":\"");
                if (sidx != -1) {
                    integer start = sidx + 13;
                    integer end = llSubStringIndex(llGetSubString(body, start, -1), "\"");
                    if (end != -1) {
                        gSessionId = llGetSubString(body, start, start + end - 1);
                        llOwnerSay("Session created: " + gSessionId);
                        llOwnerSay("Share link: " + VIEW_URL + "?session=" + gSessionId);
                    }
                }
            }

            
            body = "";

            gItemsSent++;
            llSetLinkPrimitiveParamsFast(BUTTON_LINK, [PRIM_TEXT, "What They Wearin'\nSent " + (string)gItemsSent + "/" + (string)gTotalItems, <1,1,0>, 0.5]);

            process_next_item();
        } else if (status == 307 || status == 301 || status == 302) {
            llOwnerSay("Error: API returned a redirect (status " + (string)status + ").");
            llOwnerSay("Please verify API_URL uses the final destination URL (no redirect).");
            llSetLinkPrimitiveParamsFast(BUTTON_LINK, [PRIM_TEXT, "What They Wearin'\nURL redirect error", <1,0,0>, 0.5]);
        } else {
            llOwnerSay("Error: API request failed with status " + (string)status + ".");
            llSetLinkPrimitiveParamsFast(BUTTON_LINK, [PRIM_TEXT, "What They Wearin'\nError sending data", <1,0,0>, 0.5]);
        }
    }

    timer() {
        llSetTimerEvent(0.0); 

        if (gTarget == NULL_KEY) return;

        fetch_creator_names_for(gTarget);

        if (gCreatorPending > 0 && gCreatorWaitCycles < CREATOR_WAIT_MAX_CYCLES) {
            gCreatorWaitCycles++;
            llSetTimerEvent(0.5);
            return;
        }

        
        list items = collect_items_for(gTarget);
        integer itemCount = llGetListLength(items);

        if (itemCount == 0) {
            llSetLinkPrimitiveParamsFast(BUTTON_LINK, [PRIM_TEXT, "What They Wearin'\n0 items", <1,1,1>, 0.5]);
            set_media_url(VIEW_URL);
            return;
        }

        
        gSessionId = "";
        gPendingItems = items;
        gItemsSent = 0;
        gTotalItems = itemCount;

        llSetLinkPrimitiveParamsFast(BUTTON_LINK, [PRIM_TEXT, "What They Wearin'\nSending...", <1,1,0>, 0.5]);
        process_next_item();
    }

    on_rez(integer param) {
        llResetScript();
    }
}

