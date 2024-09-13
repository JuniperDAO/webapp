#!/usr/bin/env python3

import urllib.request
import xml.etree.ElementTree
import argparse
import pathlib
import json

DEFAULT_OFAC_URL = (
    "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML"
    # "file:///Users/dave/Downloads/SDN.XML"
    # old version - broke 5/4/2024
    # "https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml"
)

NAMESPACE = {
    "sdn": "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/XML"
}

# List of assets that have been sanctioned by the OFAC.
# Possible assets be seen by grepping the sdn_advanced.xml file for "Digital Currency Address".
POSSIBLE_ASSETS = (
    "ARB BCH BSC BSV BTG DASH ETC ETH LTC USDC USDT XBT XMR XRP XVG ZEC".split()
)

# By default, only look at ERC20-like chains
DEFAULT_ASSETS = "ARB BSC ETC ETH USDC USDT".split()

# List of implemented output formats
OUTPUT_FORMATS = ["TXT", "JSON"]


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Tool to extract sanctioned digital currency addresses from the OFAC special designated nationals XML file (sdn_advanced.xml)"
    )
    parser.add_argument(
        "assets",
        nargs="*",
        help="the asset for which the sanctioned addresses should be extracted (default: XBT (Bitcoin))",
    )
    parser.add_argument(
        "-sdn",
        "--special-designated-nationals-list",
        dest="sdn_url",
        help="the URL to SDN list",
        default=DEFAULT_OFAC_URL,
    )
    parser.add_argument(
        "-f",
        "--output-format",
        dest="format",
        nargs="*",
        choices=OUTPUT_FORMATS,
        default=OUTPUT_FORMATS[0],
        help="the output file format of the address list (default: TXT)",
    )
    parser.add_argument(
        "-path",
        "--output-path",
        dest="outpath",
        type=pathlib.Path,
        default="sdn.json",
        help='the path where the lists should be written to (default: current working directory ("./")',
    )
    return parser.parse_args()


def feature_type_text(asset):
    """returns text we expect in a <FeatureType></FeatureType> tag for a given asset"""
    return "Digital Currency Address - " + asset


def get_address_id(root, asset):
    """returns the feature id of the given asset"""
    feature_type = root.find(
        "sdn:ReferenceValueSets/sdn:FeatureTypeValues/*[.='{}']".format(
            feature_type_text(asset)
        ),
        NAMESPACE,
    )
    if feature_type is None:
        raise LookupError(
            "No FeatureType with the name {} found".format(feature_type_text(asset))
        )
    address_id = feature_type.attrib["ID"]
    return address_id


def get_sanctioned_addresses(root, address_id):
    """returns a list of sanctioned addresses for the given address_id"""
    addresses = list()
    for feature in root.findall(
        "sdn:DistinctParties//*[@FeatureTypeID='{}']".format(address_id), NAMESPACE
    ):
        for version_detail in feature.findall(".//sdn:VersionDetail", NAMESPACE):
            addresses.append(version_detail.text)
    return addresses


def write_addresses_txt(addresses, asset, outpath):
    with open("{}/sanctioned_addresses_{}.txt".format(outpath, asset), "w") as out:
        for address in addresses:
            out.write(address + "\n")


def main():
    args = parse_arguments()

    assets = list()
    if type(args.assets) == str:
        assets.append(args.assets)
    else:
        assets = args.assets

    assets = assets or DEFAULT_ASSETS
    print(f'OFAC: scanning for {" ".join(sorted(assets))}')

    output_formats = list()
    if type(args.format) == str:
        output_formats.append(args.format)
    else:
        output_formats = args.format

    root = None
    print(f"OFAC: reading {args.sdn_url}...")
    with urllib.request.urlopen(args.sdn_url) as sdn:
        tree = xml.etree.ElementTree.parse(sdn)
        root = tree.getroot()
    assert root

    addresses = set()
    for child in root:
        if child.tag.endswith("sdnEntry"):
            for grandchild in child:
                if grandchild.tag.endswith("idList"):
                    for fourth_gen in grandchild:
                        if fourth_gen.tag.endswith("id"):
                            for fifth_gen in fourth_gen:
                                if fifth_gen.tag.endswith("idNumber"):
                                    if fifth_gen.text.startswith("0x"):
                                        addresses.add(fifth_gen.text.lower())

    print(f"OFAC: writing {len(addresses)} addresses to {args.outpath}...")
    with open(args.outpath, "w") as out:
        addresses = [x.lower() for x in addresses]
        addresses.sort()
        out.write(json.dumps(addresses, indent=2) + "\n")

    print(f"OFAC: wrote {len(addresses)} addresses to {args.outpath}")


if __name__ == "__main__":
    main()
