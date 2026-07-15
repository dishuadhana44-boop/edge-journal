const KEY = "emoji_skin";

export function getSkinTone(){

    return localStorage.getItem(KEY) || "default";

}

export function saveSkinTone(tone){

    localStorage.setItem(KEY,tone);

}