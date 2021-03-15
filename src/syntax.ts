/**
 * © 2021 Astronaut Labs, LLC.
 */

import { Field, Marker, Reserved } from "@astronautlabs/bitstream";
import * as SCTE104 from "@astronautlabs/scte104";
import * as ST291 from "@astronautlabs/st291";

export class Packet extends ST291.Packet {
    @Reserved(3) reserved;
    @Field(2, { writtenValue: 1 }) version = 1;
    @Field(1) continued : boolean;
    @Field(1) following : boolean;
    @Field(1) duplicate : boolean;

    @Marker() $payloadMark;

    @Field((i : Packet) => i.measure(i => i.$payloadMark, i => i.$userDataEnd) / 8, {
        serializer: new ST291.Serializer()
    }) 
    payload : Buffer;

    static packetize(message : SCTE104.elements.Message): Packet[] {
        let payload = message.serialize();
        let packetSize = 254;

        if (payload.length > 200 && message instanceof SCTE104.elements.SingleOperationMessage)
            throw new Error(`ST 2010 does not support SingleOperationMessage with length above 200 bytes`);
        
            if (payload.length > 2000 && message instanceof SCTE104.elements.MultipleOperationMessage)
            throw new Error(`ST 2010 does not support MultipleOperationMessage with length above 2000 bytes`);
        
        let sent = 0;
        let packets : Packet[] = [];

        while (sent < payload.length) {
            let size = Math.min(packetSize, payload.length - sent);
            packets.push(Object.assign(
                new Packet(),
                <Partial<Packet>>{
                    did: 0x41,
                    sdid: 0x07,
                    continued: sent > 0,
                    following: sent + size <= payload.length,
                    duplicate: false,
                    payload: payload.slice(sent, packetSize),
                }
            ));

            sent += size;
        }

        return packets;
    }
}

