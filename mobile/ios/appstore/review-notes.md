# App Review notes

Paste the "Notes" block into App Store Connect, and fill the demo account
fields in the sign-in section.

## Why this matters more than usual

The reviewer cannot reach any of the app past the first screen without an
account. Sign-up exists in the app, but production requires email
verification, and the reviewer cannot receive your confirmation mail. Without
working credentials in the review notes, this is a Guideline 2.1 rejection.

There is also a second secret. Logging in is not enough: the data is
end-to-end encrypted and a separate encryption passphrase decrypts it. A
reviewer given only an email and password will reach a locked screen and
conclude the app is broken. Both values have to be in the notes.

## Before you submit

1. Create an account on https://www.traumatrees.org with an address you
   control, and complete the email verification.
2. Sign in on the web and add a tree with a few people and a journal entry, so
   the reviewer sees a working app rather than an empty one.
3. Put that email, password, and encryption passphrase in the block below.
4. Keep the account alive until the release is approved.

## Sign-in information

- Username: `<demo account email>`
- Password: `<demo account password>`

## Notes

```
Traumatrees is a private journal and family-map for reflecting on patterns
that repeat across generations. It is a personal reflection tool, not therapy
and not crisis support, and the app says so on its first screen.

Signing in takes two steps, both required:

1. Log in with the email and password in the sign-in fields above.
2. When the app asks for an "encryption passphrase", enter:

       <demo account encryption passphrase>

The second step is not a duplicate of the password. All content is encrypted
on the device before it is stored, and the server only ever holds ciphertext.
The passphrase is what decrypts it, we never receive it, and without it the
app cannot show any content. This is the app's central privacy guarantee
rather than an extra hurdle.

After unlocking, the demo account has a family tree and journal entries.
"Tree" shows the canvas, "Journal" the entries.

Account creation is available in the app via "Create an account" on the sign-in
screen. Because production requires email confirmation, a new account cannot be
used until the emailed link is opened, which is why the account above is
provided instead.

Account deletion is available in the app under Settings -> Account -> Delete
account. It asks for the password and permanently removes the account and all
its content. Please use the demo account with care: deleting it will require
new credentials for any follow-up review.
```

## If the reviewer reports being unable to log in

Almost always the passphrase step. Check the account still exists, the
password has not been rotated, and the passphrase in the notes matches the one
the account was created with. A passphrase cannot be recovered or reset: if it
is lost, that account's content is gone and a fresh demo account is needed.
