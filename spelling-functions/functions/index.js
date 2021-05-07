/**
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Import the Actions SDK
const {conversation} = require('@assistant/conversation');
// Import the Firebase SDK for Cloud Functions
const functions = require('firebase-functions');

const https = require('https');
const app = conversation();
const cors = require('cors')({origin: true});

// Import and initialize the Firebase Admin SDK.
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// Retrieves word definition and audio pronunciation from api.dictionaryapi.dev service
// Function uses service provided by https://dictionaryapi.dev/
async function getWordDetailsFromDictionaryAPI(word) {
  let responseData="";
  let req = https.request({
    host: 'api.dictionaryapi.dev',
    port: 443,
    path:'/api/v2/entries/en/' + word,
    method:'GET'
  }, (res) => {
    res.setEncoding('utf8');
    res.on('data', d => {
        responseData+=d;
    })
    res.on('end',function(){
        let object = JSON.parse(responseData)
        const wordListRef = db.collection('wordlist');
        wordListRef.doc(object[0].word).set(
          object[0]
        );
       return responseData;
     });
  });
  req.end();
}

// Firestore trigger that fetches word definitions through getWordDetailsFromDictionaryAPI for every new Firestore document
exports.createSpellingPracticeWord = functions.firestore
  .document('wordlist/{word}')
  .onCreate((snap, context) => {
    const newValue = snap.data();
    const word = newValue.word;
    getWordDetailsFromDictionaryAPI(word);
});

// Store the list of spelling words in Assistant session
app.handle('getSpellingWordList', conv => {
  const wordListRef = db.collection('wordlist').limit(50);
  const snapshot = wordListRef;

  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }  
  VocabularyList = []

  return snapshot.get().then(snapshot => {
    snapshot.forEach(doc => {
      if (doc.data().word) {
          let definition = 'unknown';
          let audio = 'unknown';
          try {
            if(doc.data().hasOwnProperty('meanings')) {
              if(doc.data().meanings[0].hasOwnProperty('definitions')) {
                  definition = doc.data().meanings[0].definitions[0].definition;
              }
            }
            if(doc.data().hasOwnProperty('phonetics')) {
              if(doc.data().phonetics.length > 0)
                audio = doc.data().phonetics[0].audio;
            }
          } catch (error) {
            console.log(error);
          }

          let obj = {
            word: doc.data().word,
            answer: doc.data().word.split("").join(" "),
            definition: definition,
            audio: audio
          }
          VocabularyList.push(obj);
      }
      
      // shuffle the array
      let currentIndex = VocabularyList.length, temporaryValue, randomIndex;
      while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = VocabularyList[currentIndex];
        VocabularyList[currentIndex] = VocabularyList[randomIndex];
        VocabularyList[randomIndex] = temporaryValue;
      }
    
      conv.session.params.vocabWord = VocabularyList;
      conv.session.params.vocabWordIndex = 0;
    });
  });
})

// Returns a spelling practice word to Google Assistant and uses Speech Synthesis Markup Language (SSML) to format the response
app.handle('getSpellingWord',  conv => {
  if (!conv.session.params.vocabWord.empty) {
    conv.session.params.vocabWordIndex += 1;
    const ssml = '<speak>' +
    '<audio src="'+ conv.session.params.vocabWord[conv.session.params.vocabWordIndex].audio +'">Use phonetics to spell the word.</audio> ' +
    '</speak>';
    conv.add(ssml);
  }
  else
    conv.add('Great job! You completed the Spelling practice');
});

// Returns current spelling word
app.handle('repeatSpellingWord',  conv => {
  if (!conv.session.params.vocabWord.empty) {
    const ssml = '<speak>' +
    '<audio src="'+ conv.session.params.vocabWord[conv.session.params.vocabWordIndex].audio +'">Use phonetics to spell the word. </audio> ' +
    '</speak>';
    conv.add(ssml);
  }
  else
    conv.add('Great job! You completed the Spelling practice');
});

// Returns spelling word definition from Assistant session parameter
app.handle('definitionOfSpellingWord',  conv => {
  conv.add( 'It means ' + conv.session.params.vocabWord[conv.session.params.vocabWordIndex].definition);
});

// Verifies user spelling response
app.handle('verifySpellingWord', conv => {
  try {
    userResponse = conv.intent.params.userresponse.resolved.join("");
    if (userResponse.toLowerCase() === conv.session.params.vocabWord[conv.session.params.vocabWordIndex].word.toLowerCase()) {
      conv.add('You are correct. Say next to continue.');
    }
    else {
      conv.add('Sorry, wrong answer. The correct answer is ' + conv.session.params.vocabWord[conv.session.params.vocabWordIndex].answer + ' . Say next to continue.');
    }   
  } catch (error) {
    conv.add('Sorry. I did not understand your response' );
  }  
});

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
  
    
