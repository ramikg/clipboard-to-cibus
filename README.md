# Clipboard to Cibus

Tired of manually filling the Cibus payments form at the end of a Wolt order?  
_Clipboard to Cibus_ is a userscript which fills it for you, using Bolt's output as the source of information.

> [!CAUTION]
> Using this userscript may incur unexpected charges. Use at your own risk.

## Installation

0. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/).
1. Install _Clipboard to Cibus_ by clicking [here](https://github.com/ramikg/clipboard-to-cibus/raw/main/clipboard-to-cibus.user.js).

## Usage

| Bolt output (`Ctrl-C`)                    | Before `Ctrl-V`                              | After `Ctrl-V`                             |
|-------------------------------------------|----------------------------------------------|--------------------------------------------|
| ![Bolt output](resources/bolt_output.png) | ![Before Ctrl-V](resources/before_paste.png) | ![After Ctrl-V](resources/after_paste.png) |

If the names don't match up, the userscript will ask you for assistance and remember your answer.

## FAQ

### How can I modify the stored mapping from names to cibus IDs?

Use the built-in storage editor of your userscript manager.

In Tampermonkey, the userscript's _Storage_ tab appears only if Tampermonkey's config mode is set to _Advanced_ and the script has stored data.
