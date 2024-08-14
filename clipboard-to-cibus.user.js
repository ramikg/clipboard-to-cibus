// ==UserScript==
// @name        Clipboard to Cibus
// @description Autofill Cibus payment information using clipboard data
// @version     0.0.8
// @author      Rami
// @namespace   https://github.com/ramikg
// @icon        https://consumers.pluxee.co.il/favicon.ico
// @match       https://myconsumers.pluxee.co.il/Auth.aspx?*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @grant       GM.getValue
// @grant       GM.setValue
// @grant       GM.listValues
// @downloadURL https://github.com/ramikg/clipboard-to-cibus/raw/main/clipboard-to-cibus.user.js
// @updateURL   https://github.com/ramikg/clipboard-to-cibus/raw/main/clipboard-to-cibus.user.js
// ==/UserScript==

'use strict';

let cibusUsers;
const userSuppliedIdPrefix = '__';
const PAYMENT_OWNER_SPECIAL_VALUE = 'PAYMENT_OWNER';
const TOTALS_DIFFERENCE_THRESHOLD = 0.1;

/* Code from auth-split.js (comments are mine) */
var friends = JSON.parse(document.forms[0].hfFriends.value);
var total = 1 * $('h2 big').first().text()
var before = $('.addFriend');
var addable = $('#friendsList');
var my_share = $('#splitList input');

function recalcMyShare(e) {
    var t = total, shares = [];
    for (var id in friends) {
        var p = friends[id].price;
        if (p) {
            t -= p;
            shares.push({ user_id: id, price: p });
        }
    }
    if (t < 0) { // Originally "t <= 0", but this prevents the payment owner from not participating in the order
        if (e) e.preventDefault();
        return false;
    }
    my_share.val("₪" + Math.round(100 * t) / 100).css('text-align', $('#direction').val() == "ltr" ? "right" : "left");
    document.forms[0].hfSplitPay.value = JSON.stringify(shares);
    return true;
}

function addFriendId(friend, id) {
    friend.input = $('<input>').val(friend.price).data('u', id).css('text-align', $('#direction').val() == "ltr" ? "right" : "left");
    $('<div>').append(
        $('<b class="del">x</b>').data('u', id),
        $('<label>').append(
            $('<span>').text(friend.Name).css('text-align', $('#direction').val() == "ltr" ? "left" : "right"),
            $('<u>').append(friend.input)
        )
    ).insertBefore(before);
}

// This function adds the friend to the non-participants list
function removeFriendId(friend, id) {
    addable.append(
      $('<label>').data('u', id).append(
        $('<input name="addMe" type="checkbox" />'),
        $('<span>').text(friend.Name)
      )
    );
}

function changeFriendPrice(e) {
    var id = $(this).data('u');
    console.log(`Changing price for ${id}`);
    var prev = friends[id].price;
    friends[id].price = 1 * this.value;
    // even = false;
    if (!recalcMyShare(e)) {
        this.value = friends[id].price = prev;
        return false;
    }
    return true;
}

function addFriend() {
    var id = $(this).data('u'), f = friends[id];
    console.log(`Adding ${id}`);
    $(this).remove();
    if (addable.children().length === 0) {
        $('#cbFriendsList').prop('checked', false);
        before.hide();
    }
    // ++count;
    f.price = 0;
    addFriendId(f, id);
    // if (even) redistribute();
    f.input.focus();
}

function removeFriend() {
    var id = $(this).data('u');
    console.log(`Removing ${id}`);
    $(this).closest('div').remove();
    // --count;
    delete friends[id].price;
    // if (even) redistribute();
    recalcMyShare();
    removeFriendId(friends[id], id);
    before.show();
}

/*  End of code from auth-split.js */

function initCibusUsers() {
    const sortingFunction = ([id1, metadata1], [id2, metadata2]) => metadata1.Name?.localeCompare(metadata2.Name);
    cibusUsers = new Map(Object.entries(friends).sort(sortingFunction));
}

async function askUserToIdentifyName(nameOptions) {
    let formattedNameOptions = nameOptions[0];
    if (nameOptions[1] && nameOptions[1] !== nameOptions[0]) {
        formattedNameOptions += ` (${nameOptions[1]})`;
    }

    const container = document.createElement('div');
    container.id = 'userSelectContainer';
    container.style.padding = '20px';
    container.style.fontFamily = 'Arial, sans-serif';

    const description = document.createElement('p');
    description.innerHTML = `Please help me locate <b>${formattedNameOptions}</b> in the list below<br>(or choose to pay for them). I will remember your choice.`;
    description.style.direction = 'ltr';
    description.style.textAlign = 'left';
    container.appendChild(description);

    const paymentOwnerButton = document.createElement('button');
    paymentOwnerButton.textContent = 'That\'s (on) me';
    paymentOwnerButton.style.padding = '8px 20px';
    paymentOwnerButton.style.borderRadius = '4px';
    paymentOwnerButton.style.border = '1px solid #ccc';
    paymentOwnerButton.style.cursor = 'pointer';
    container.appendChild(paymentOwnerButton);

    const select = document.createElement('select');
    select.id = 'userSelectDropdown';
    select.style.padding = '8px';
    select.style.width = '200px';
    select.style.borderRadius = '4px';
    select.style.border = '1px solid #ccc';
    container.appendChild(select);

    const placeholderOption = document.createElement('option');
    placeholderOption.textContent = 'Please select a matching name';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    select.appendChild(placeholderOption);

    cibusUsers.forEach((metadata, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = metadata.Name;
        select.appendChild(option);
    });

    document.body.prepend(container);

    async function getUserSuppliedNamesAssociatedWithCibusUserId(cibusUserId) {
        const names = [];
        const keys = await GM.listValues();
        for (let key of keys) {
            const value = await GM.getValue(key);
            if (value === cibusUserId) {
                names.push(key.replace(userSuppliedIdPrefix, ''));
            }
        }

        return names;
    }

    async function handleUserAction(cibusUserId, name, resolve, container) {
        const namesAssociatedWithCibusUserId = await getUserSuppliedNamesAssociatedWithCibusUserId(cibusUserId);
        const cibusUserString = cibusUserId === PAYMENT_OWNER_SPECIAL_VALUE ? 'Your Cibus user' : `The Cibus user ${name}`;
        const confirmationMessage = `Are you sure?\n${cibusUserString} is already associated with the following names: ${namesAssociatedWithCibusUserId.join(', ')}`;
        if (!namesAssociatedWithCibusUserId.length || confirm(confirmationMessage)) {
            resolve(cibusUserId);
            container.remove();
        }
    }

    return await new Promise(async (resolve) => {
        select.addEventListener('change', async () => {
            if (select.selectedIndex !== 0) {
                await handleUserAction(select.value, select.selectedOptions[0].textContent, resolve, container)
            }
        });

        paymentOwnerButton.addEventListener('click', async () => await handleUserAction(PAYMENT_OWNER_SPECIAL_VALUE, '', resolve, container));
    });
}

async function getCibusId(nameOptions) {
    const firstNameOption = nameOptions[0];
    let userSuppliedId = await GM.getValue(userSuppliedIdPrefix + firstNameOption);
    if (userSuppliedId) {
        return userSuppliedId === PAYMENT_OWNER_SPECIAL_VALUE ? undefined : userSuppliedId;
    }

    for (const [id, metadata] of cibusUsers) {
        if (nameOptions.includes(metadata.Name)) {
            return id;
        }
    }

    userSuppliedId = await askUserToIdentifyName(nameOptions);
    if (userSuppliedId) {
        await GM.setValue(userSuppliedIdPrefix + firstNameOption, userSuppliedId);
        return userSuppliedId;
    }

    throw new Error(`Failed getting cibus ID for name ${nameOptions}`);
}

function getParsedBoltUsers(boltOutput) {
    const BOLT_OUTPUT_USER_REGEX = /(@(?<slackName>[\p{L}\p{M}*\s\w]+))?\(?(?<woltName>[\p{L}\p{M}*\s\w]+)\)?: (?<amount>\d+(\.\d+)?)/gmu;
    const rawRegexResult = boltOutput.matchAll(BOLT_OUTPUT_USER_REGEX);

    return Array.from(rawRegexResult).map(
        parsedUser => {
            const rawNameOptions = [parsedUser.groups.slackName, parsedUser.groups.woltName];
            const nameOptions = [];
            for (const rawNameOption of rawNameOptions) {
                const nameOption = rawNameOption?.trim();
                if (nameOption) {
                    nameOptions.push(nameOption);
                }
            }

            return {nameOptions, amount: parseFloat(parsedUser.groups.amount)};
        }
    );
}

async function waitForBoltOutput() {
    const textBox = document.createElement('input');
    textBox.type = 'text';
    textBox.placeholder = 'Paste Bolt output...';
    textBox.style.direction = 'ltr';
    textBox.style.textAlign = 'left';
    textBox.style.border = '2px solid #009de0';
    textBox.style.fontSize = '16px';
    textBox.style.padding = '8px';
    textBox.style.borderRadius = '5px';
    textBox.style.outline = 'none';
    textBox.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';

    const totalAmount = document.getElementById('hSubTitle');
    totalAmount.insertAdjacentElement('afterend', textBox);

    return await new Promise(resolve => {
        textBox.addEventListener('input', () => {
            resolve(textBox.value);
            textBox.remove();
        });
    });
}

(async () => {
    // Reset past attempts
    document.forms[0].hfSplitPay.value = [];

    initCibusUsers();

    // Allow removing friends and changing prices
    $('#splitList').on('click', '.del', removeFriend).on('change', 'input', changeFriendPrice);
    // Allow adding friends
    addable.on('click', 'label', addFriend);
    // Hide non-participants
    $('#cbFriendsList').prop('checked', false);

    let clipboardTotalMinusCibusTotal;
    let parsedBoltUsers;

    do {
        const boltOutput = await waitForBoltOutput();
        parsedBoltUsers = getParsedBoltUsers(boltOutput);

        const clipboardTotalOutput = parsedBoltUsers.reduce((sum, currentUser) => sum + currentUser.amount, 0);
        clipboardTotalMinusCibusTotal = clipboardTotalOutput - total;

        if (clipboardTotalMinusCibusTotal > TOTALS_DIFFERENCE_THRESHOLD) {
            alert(`The total clipboard amount is ${clipboardTotalMinusCibusTotal.toFixed(2)} greater than the required amount. Please try again.`);
        }
    } while (clipboardTotalMinusCibusTotal > TOTALS_DIFFERENCE_THRESHOLD);

    let extraAmountToAddToEachUser = 0;
    const cibusTotalMinusClipboardTotal = -clipboardTotalMinusCibusTotal;
    if (cibusTotalMinusClipboardTotal > TOTALS_DIFFERENCE_THRESHOLD) {
        extraAmountToAddToEachUser = +(cibusTotalMinusClipboardTotal / parsedBoltUsers.length).toFixed(2);
        console.log(`Adding ${extraAmountToAddToEachUser} to each user`);
        alert(`The total clipboard amount is ${cibusTotalMinusClipboardTotal.toFixed(2)} lower than the required amount. The difference will be split equally.`);
    }

    const participatingCibusIds = new Set();

    for (const parsedBoltUser of parsedBoltUsers) {
        if (!parsedBoltUser.amount) { // Float comparison is good enough for our usage
            continue;
        }

        const cibusId = await getCibusId(parsedBoltUser.nameOptions);
        const cibusUser = cibusUsers.get(cibusId);
        if (cibusUser) {
            console.log(`${parsedBoltUser.nameOptions} mapped to Cibus user ${JSON.stringify(cibusUser.Name)} (ID ${cibusId})`);
            cibusUser.price = (cibusUser.price ?? 0) + parsedBoltUser.amount + extraAmountToAddToEachUser;
            participatingCibusIds.add(cibusId);
        } else {
            console.log(`${parsedBoltUser.nameOptions} mapped to payment owner`);
        }
    }

    console.log(cibusUsers);

    for (const cibusId of participatingCibusIds) {
        addFriendId(cibusUsers.get(cibusId), cibusId);
    }
    recalcMyShare();

    // Re-populate the non-participants list
    addable.empty();
    for (const id in friends) {
        if (!friends[id].price) {
            removeFriendId(friends[id], id);
        }
    }

    // Show participants
    $('#cbSplit').prop('checked', true);
})();
