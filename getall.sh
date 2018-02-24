#!/bin/bash

servers=(
"alturas"
"frankfurt"
"genesis"
"mumbai"
"saopaulo"
"singapore"
"tokyo"
)

help() {
  printf "\nRetrieve a DID from all the nodes:\n\n
Usage: getall.sh <DID>\n\n" 1>&2
  exit
}

if [ "$#" -ne 1 ] ; then help ; fi

while true; do
  case "$1" in
    -h|--help) help ;;
    *) break ;;
  esac
done

for s in "${servers[@]}"
do
  printf "\nAsking ${s}.testnet.veres.one\n"
  ./did --hostname ${s}.testnet.veres.one get $1
done
