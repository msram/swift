// ==UserScript==
// @name         Swift
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  DrawASaurus word guessing assistant
// @author       M S Ram
// @match        *://www.drawasaurus.org/room/*
// @require      https://raw.githubusercontent.com/eligrey/FileSaver.js/master/src/FileSaver.js
// @grant       GM.getValue
// @grant       GM.setValue
// @grant       GM.setClipboard
// ==/UserScript==

const MAX_SUGGESTIONS = 20;
const SECRET_WORD_CLASS = 'bjdzi3s';
const REVEALED_WORD_CLASS = 'bpdkjfp';
const GUESS_TEXT_BOX_CLASS = 'i1qmcb96';
const HEADER_CLASS = 'czbl7c3';
const CHAT_WINDOW_CLASS = 'b1bm64re';
const CHAT_MESSAGE_CLASS = 'cj65bg4';

const SPACEBAR = 32;
const ENTER = 13;
const LEFT_ARROW = 37;
const UP_ARROW = 38;
const RIGHT_ARROW = 39;
const DOWN_ARROW = 40;

var guessing_done = false;

var handled_keys = [
    ENTER, LEFT_ARROW, UP_ARROW, RIGHT_ARROW, DOWN_ARROW
];

var guess_text_box;
var candidates = [];

var word_frequency = JSON.parse(
    await GM.getValue('word_frequency', '{}')
);
var similar_words = JSON.parse(
    await GM.getValue('similar_words', '{}')
);


// Keep the following code that converts words to lower case
// var word_frequency_ = {};

// var word_list = Object.keys(word_frequency);
// for(var i=0; i<word_list.length; i++) {
//     var key = word_list[i];
//     console.log(key.toLowerCase(), word_frequency[key]);
//     word_frequency_[key.toLowerCase()] = word_frequency[key];
// }
// word_frequency = word_frequency_;

var word_list = Object.keys(word_frequency);
if(Object.keys(similar_words).length != word_list.length) {
    similar_words = compute_similar_words(word_list);
    GM.setValue('word_frequency', JSON.stringify(word_frequency));
    GM.setValue('similar_words', JSON.stringify(similar_words));
}
var amplified_frequency = get_amplified_frequencies();

var stored_values = "word_frequency = " + JSON.stringify(
    word_frequency, null, 4
);
GM.setClipboard(
    stored_values,
    { type: 'text', mimetype: 'text/plain' }
);
// alert("Word frequency dictionary and similar words dictionary have been copied to clipboard.");

function get_amplified_frequencies() {
    /*
        Amplify the word frequencies based on similarity;
        For example, "lake" and "cake" are similar words,
        guessing one of them can match the other. So we
        can combine their frequncies.
    */
    var word_list = Object.keys(word_frequency);
    var amplified_frequency = {};
    for(var i=0; i<word_list.length; i++) {
        var w = word_list[i]; // current word
        amplified_frequency[w] = 0;
        var s_words = similar_words[w];
        for(var j=0; j<s_words.length; j++) {
            amplified_frequency[w] += word_frequency[s_words[j]];
        }
    }
    return amplified_frequency;
}

function update_word_frequency(word) {
    /*
        Update word_frequency and amplified_word_frequency,
        for the given word and its similar words.
    */
    var s_words, j;
    if( word in word_frequency ) {
        word_frequency[word] += 1;
        s_words = similar_words[word];
        for(j=0; j<s_words.length; j++) {
            amplified_frequency[s_words[j]] += 1;
        }
    } else {
        word_frequency[word] = 1;
        amplified_frequency[word] = 1;
        s_words = get_similar_words(word);
        for(j=0; j<s_words.length; j++) {
            amplified_frequency[s_words[j]] += 1;
            similar_words[s_words[j]].push(word);
            amplified_frequency[word] += word_frequency[s_words[j]];
            // console.log(s_words[j], word_frequency[s_words[j]], amplified_frequency[s_words[j]]);
        }
        // console.log(amplified_frequency[word]);
        similar_words[word] = s_words.concat([word]);
        word_list.push(word);
    }
    GM.setValue('word_frequency', JSON.stringify(word_frequency));
    GM.setValue('similar_words', JSON.stringify(similar_words));
}

function get_similar_words(input_word) {
    /*
        Get similar words of the input_word,
        from the global word_list.

        Two words are similar if their edit
        distance is within epsilon, where
        epsilon is 1 for words of length less
        than 7, and 2 otherwise.

        Note: Every word is similar to itself.
    */
    var s_words = [];
    var eps = input_word.length > 6 ? 2 : 1;
    for(var i=0; i<word_list.length; i++) {
        if(
            Math.abs(input_word.length - word_list[i].length) == 0 &&
            edit_distance(input_word, word_list[i]) <= eps
        ) {
            s_words.push(word_list[i]);
        }
    }
    return s_words;
}

function compute_similar_words() {
    /*
        For each word in the global word_list,
        compute the list of similar words.
    */
    var startTime = new Date();
    var similar_words = {};
    for(var i=0; i<word_list.length; i++) {
        var w = word_list[i]; // current word
        similar_words[w] = get_similar_words(w); // similar words
        // console.log(w, similar_words[w]);
    }
    var endTime = new Date();
    console.log(
        'Time taken for computing similar words: ' +
        (endTime-startTime)/1000 + 's.'
    );
    return similar_words;
}

function edit_distance(str1, str2) {
    /*
        Compute the edit distance between the two input
        strings: str1, str2.
        Ref: https://bit.ly/3ovy4pY
    */
    const track = Array(str2.length + 1).fill(null).map(
        () => Array(str1.length + 1).fill(null)
    );
    for (let i = 0; i <= str1.length; i += 1) {
        track[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j += 1) {
        track[j][0] = j;
    }
    for (let j = 1; j <= str2.length; j += 1) {
        for (let i = 1; i <= str1.length; i += 1) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                // track[j][i - 1] + 1, // deletion
                // track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator, // substitution
            );
        }
    }
    return track[str2.length][str1.length];
}

function have_same_length_strings(a1, a2) {
    // Return true if arrays a1 and a2 have the same
    // length and for all i a1[i] and a2[i] are of the
    // same length; else false.
    if( a1.length != a2.length ) {
        return false;
    }

    for(var i = 0; i < a1.length; i++) {
        if(a1[i].length != a2[i].length) {
            return false;
        }
    }
    return true;
}


function letter_index(s) {
    var m = s.match(/[A-Za-z]/);
    return m? m.index : -1;
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function color_trace(msg, color) {
    console.log("%c" + msg, "color:" + color + ";font-weight:bold;");
}

function on_header_change(header) {
    var span;
    console.clear();
    var header_string = header.innerText;
    console.log(header_string);
    if(header_string.indexOf("drawing") >= 0) {
        mi = 0;
    }

    // Header before guessing
    var secret_word_spans = header.getElementsByClassName(SECRET_WORD_CLASS);
    if (secret_word_spans.length > 0) {
        span = secret_word_spans[0];
        var secret_word = span.innerText.toLowerCase();
        if(secret_word.indexOf('_') >= 0) {
            // Mark guessing as not done
            guessing_done = false;

            console.log(secret_word);
            var words = secret_word.split(' ');
            var nw = words.length;
            var s = nw > 1 ? "words" : "word";
            console.log(nw, s);
            var L = words.map(function (s){return String(s.length)}).join();
            console.log(L, "letters.");
            var li = letter_index(secret_word);

            // Build a list of candidate guess words that have the same length
            // as the secret word
            candidates = Object.keys(word_frequency).filter(
                function(s) {
                    return (
                        (li == -1 || secret_word[li] == s[li]) &&
                        have_same_length_strings(s.split(' '), secret_word.split(' '))
                    );
                }
            );

            // Shuffle and sort candidates; shuffling helps in generating different
            // sequneces of words with same frequencies.
            candidates = shuffle(candidates).sort(
                (a, b) => amplified_frequency[b] - amplified_frequency[a]
            ).map((s)=>s.toLowerCase());

            // Log the candidates
            for(var i=0; i<Math.min(candidates.length, MAX_SUGGESTIONS); i++) {
                console.log(
                    candidates[i],
                    word_frequency[candidates[i]],
                    amplified_frequency[candidates[i]]
                );
            }

            // When there is only one candidate, suggest it as the guess word
            if(candidates.length == 1)
            {
                guess_text_box.value = candidates[0];
            }
        }
    }
    else {
        console.log('SECRET_WORD_CLASS not found.');
    }

    // Header after guessing
    var revealed_word_spans = header.getElementsByClassName(REVEALED_WORD_CLASS);
    if (revealed_word_spans.length > 1) {
        // There will be two spans of the same class after guessing
        span = revealed_word_spans[1];
        var revealed_word = span.innerHTML.toLowerCase();
        if (header_string.indexOf("was drawing") >= 0 && revealed_word.indexOf('_') == -1) {
            // Guessing is over or timed out.
            revealed_word = revealed_word.toLowerCase();
            update_word_frequency(revealed_word);
            console.log(header_string);
        }

        // Mark guessing as done
        guessing_done = true;
    }
}

function get_partial_matches(input, candidates) {
    var matching_candidates = [];
    console.log("Input: " + input);
    matching_candidates = candidates.filter(
        (s) => s.toLowerCase().startsWith(input.toLowerCase())
    )
    console.log("%cMatching candidates: ", "font-weight:bold")
    // console.log("%c" + matching_candidates, "color:gray");
    return matching_candidates;
}

var wi = 0;
var mi = 0;
function suggest_text(e) {
    var user_input = "";
    var guessed_word = "";
    var matching_candidates = [];

    if( handled_keys.includes(e.keyCode) ) {
        console.log("Magic!");
        var si = e.target.selectionStart; // Caret position
        var input_text = guess_text_box.value;
        if(e.keyCode === ENTER) {
            console.log("Submitting " + input_text);
            guess_text_box.value = "";
            user_input = "";
            matching_candidates = [];
        }
        else if (e.keyCode === LEFT_ARROW) { // LEFT arrow
            if(si > 0) {
                user_input = input_text.slice(0, Math.max(si - 1, 0));
            }
        }
        else if (e.keyCode === RIGHT_ARROW) { // RIGHT arrow
            user_input = input_text.slice(0, Math.min(si + 1, input_text.length));
            console.log('User input: ' + user_input)
        }

        matching_candidates = get_partial_matches(user_input, candidates);
        var n = matching_candidates.length;
        // console.log('Matching candidates: ' + matching_candidates);
        for(var k=0; k<Math.min(n, MAX_SUGGESTIONS); k++) {
            console.log(
                matching_candidates[k],
                word_frequency[matching_candidates[k]],
                amplified_frequency[matching_candidates[k]]
            );
        }

        if (e.keyCode === UP_ARROW) { // UP arrow
            mi = mi-1;
            if( mi < 0 ) {
                mi = n-1;
            }

        }
        else if (e.keyCode === DOWN_ARROW) { // DOWN arrow
            mi = (mi+1) % n;
        }

        if (n > 0) {
            guess_text_box.value = matching_candidates[mi%n];
        }

        if (guess_text_box.value == "undefined") {
            guess_text_box.value = "";
        }
    }
}

function prune_candidates() {
    // Remove the words which were already guessed, from the candidates array.
    var chat_message_classes = document.getElementsByClassName(CHAT_MESSAGE_CLASS);

    var removed_words = [];
    for(var i=0; i<chat_message_classes.length; i++) {
        var text = chat_message_classes[i].innerText;
        if(text.indexOf(':') != -1) {
            var word = text.split(":")[1].toLowerCase().trim();
            if(word.split(" ").length < 3) {
                if(word in similar_words) {
                    removed_words = removed_words.concat(similar_words[word]);
                    // console.log(removed_words);
                }
            }
            // console.log(word);
        }
    }

    removed_words = [...new Set(removed_words)];

    candidates = candidates.filter(function(x) { return removed_words.indexOf(x) < 0 })
    console.log(removed_words.length, candidates.length);
    console.log('Removed words: ', removed_words);
    console.log('candidates: ', candidates);

    var matches = get_partial_matches('', candidates);
    for(i=0; i<Math.min(matches.length, MAX_SUGGESTIONS); i++) {
        console.log(matches[i], word_frequency[matches[i]], amplified_frequency[matches[i]]);
    }
    // candidates
}

var registered = false;
function register_text_events() {
    // Register text events if not registered already.
    if(!registered) {
        var reg_count = 0;
        var listener_count = 3;
        var text_inputs = document.getElementsByClassName(GUESS_TEXT_BOX_CLASS)
        if( text_inputs.length > 0) {
            guess_text_box = text_inputs[0];
            guess_text_box.onkeydown = suggest_text;
            guess_text_box.oninput = (e) => get_partial_matches(e.target.value, candidates);
            reg_count += 1;
        }

        // Add an event listener to check if there are any changes
        // in the chat window.
        var chats = document.getElementsByClassName(CHAT_WINDOW_CLASS);
        if( chats.length > 0) {
            // Create an observer instance.
            var observer = new MutationObserver(function(mutations) {
                prune_candidates();
            });

            // Pass in the target node, as well as the observer options.
            observer.observe(chats[0], {
                // attributes:    true,
                childList:     true
                // characterData: true
            });
            reg_count += 1;
        }

        // Register an event to detect changes in the header region where the query word appears
        var headers = document.getElementsByClassName(HEADER_CLASS);
        if(headers.length > 0) {
            var header = headers[0];
            console.log('detected header');
            console.log(header.innerHTML);
            header.addEventListener('DOMSubtreeModified', function _(){ on_header_change(header) });
            reg_count += 1;
        }
        if( reg_count >= listener_count && (reg_count % listener_count) == 0) {
            registered = true;
        }
    }
    if(registered) { // don't say else
        guess_text_box.focus();
    }
}


// Register the events on the guessing text box
document.addEventListener('click', register_text_events, true);
