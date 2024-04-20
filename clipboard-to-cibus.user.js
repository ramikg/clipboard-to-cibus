// ==UserScript==
// @name        clipboard-to-cibus
// @description Autofill Cibus payment information using clipboard data
// @version     0.0.1
// @author      Rami
// @namespace   https://github.com/ramikg
// @icon        https://consumers.pluxee.co.il/favicon.ico
// @match       https://myconsumers.pluxee.co.il/Auth.aspx?*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @grant       GM.getValue
// @grant       GM.setValue
// @downloadURL https://github.com/ramikg/clipboard-to-cibus/raw/main/clipboard-to-cibus.user.js
// @updateURL   https://github.com/ramikg/clipboard-to-cibus/raw/main/clipboard-to-cibus.user.js
// ==/UserScript==

let cibusUsers;
const userSuppliedIdPrefix = '__';
const PAYMENT_OWNER_SPECIAL_VALUE = 'PAYMENT_OWNER';

/* Code from auth-split.js (comments are mine) */
var friends = JSON.parse(document.forms[0].hfFriends.value);
var total = 1 * $('h2 big').first().text()
var before = $('.addFriend');
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
    // if (t <= 0) {
    //     if (e) e.preventDefault();
    //     return false;
    // }
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
/*  End of code from auth-split.js */

function initCibusUsers() {
    cibusUsers = new Map(Object.entries(friends));
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
    description.innerHTML = `Please help me locate ${formattedNameOptions} in the list below<br>(or choose to pay for them). I will remember your choice.`;
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

    cibusUsers.forEach((metadata, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = metadata.Name;
        select.appendChild(option);
    });

    document.body.prepend(container);

    return await new Promise(resolve => {
        select.addEventListener('change', function () {
            resolve(this.value);
            container.remove();
        });

        paymentOwnerButton.addEventListener('click', () => {
            resolve(PAYMENT_OWNER_SPECIAL_VALUE);
            container.remove();
        });
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
    await GM.setValue(userSuppliedIdPrefix + firstNameOption, userSuppliedId);

    return userSuppliedId;
}

function getParsedBoltUsers(boltOutput) {
    const BOLT_OUTPUT_USER_REGEX = /(@(?<slackName>[\p{L}\p{M}*\s]+))?\(?(?<woltName>[\p{L}\p{M}*\s]+)\)?: (?<amount>\d+(\.\d+)?)/gmu;
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
    initCibusUsers();
    const boltOutput = await waitForBoltOutput();
    const parsedBoltUsers = getParsedBoltUsers(boltOutput);

    const participatingCibusIds = new Set();

    for (const parsedBoltUser of parsedBoltUsers) {
        if (!parsedBoltUser.amount) { // Float comparison is good enough for our usage
            continue;
        }

        const cibusId = await getCibusId(parsedBoltUser.nameOptions);
        const cibusUser = cibusUsers.get(cibusId);
        if (cibusUser) {
            cibusUser.price = (cibusUser.price ?? 0) + parsedBoltUser.amount;
            participatingCibusIds.add(cibusId);
        }
    }

    console.log(cibusUsers);

    for (const cibusId of participatingCibusIds) {
        addFriendId(cibusUsers.get(cibusId), cibusId);
    }
    recalcMyShare();

    // Show participants
    $('#cbSplit').prop('checked', true);
})();
