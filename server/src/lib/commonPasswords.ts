// Base words that show up in nearly every breached-password list. The policy
// strips digits and symbols before comparing, so "Password123!" is caught
// by "password" rather than needing every variant listed. Deliberately a
// short list, not a breach corpus: it blocks the guesses an attacker tries
// first without pretending to be a full breach check.
export const COMMON_PASSWORD_WORDS: readonly string[] = [
  "password", "passw0rd", "passwort", "letmein", "welcome", "iloveyou", "admin", "administrator",
  "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbn", "zxcvbnm", "azerty", "abc", "abcdef",
  "monkey", "dragon", "football", "baseball", "basketball", "soccer", "hockey", "cricket",
  "sunshine", "princess", "superman", "batman", "spiderman", "pokemon", "starwars", "master",
  "shadow", "michael", "jessica", "ashley", "charlie", "jennifer", "daniel", "thomas", "robert",
  "trustno", "freedom", "whatever", "computer", "internet", "secret", "login", "hello", "hunter",
  "killer", "lovely", "loveme", "babygirl", "mustang", "ranger", "harley", "tigger", "buster",
  "summer", "winter", "spring", "autumn", "flower", "cookie", "chocolate", "butterfly",
  "changeme", "default", "guest", "root", "test", "testing", "temp", "temporary", "user",
  "access", "secure", "security", "private", "money", "google", "facebook", "samsung", "apple",
  "india", "mumbai", "delhi", "bangalore", "chennai", "kolkata", "hyderabad", "krishna", "ganesh",
  "women", "woman", "health", "cycle", "period", "wellness", "women360", "myhealth", "pregnant",
  "mypassword", "yourpassword", "newpassword", "mypass", "pass", "pass1234", "p4ssword",
];
