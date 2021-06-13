/**
 * © 2021 Astronaut Labs, LLC.
 */

import { Field, Marker, Reserved, ReservedLow, Variant } from "@astronautlabs/bitstream";
import * as SCTE104 from "@astronautlabs/scte104";
import * as ST291 from "@astronautlabs/st291";

export interface PacketizationOptions {
    duplicate? : boolean;
}

export const DID = 0x41;
export const SDID = 0x07;
@Variant(i => i.did == DID && i.sdid == SDID)
export class Packet extends ST291.Packet {
    constructor() {
        super();
        this.did = DID;
        this.sdid = SDID;
    }

    @Field(2, { 
        writtenValue: i => ST291.parity(
            i.serialize(i => i.$payloadDescriptorStart, i => i.$payloadDescriptorEnd)[0]
        ) 
    }) 
    payloadDescriptorParity : number;

    @Marker() $payloadDescriptorStart;

    @ReservedLow(3, { writtenValue: 0 }) reserved = 0;
    @Field(2, { writtenValue: 1 }) version : number = 1;
    @Field(1) continued : boolean;
    @Field(1) following : boolean;
    @Field(1) duplicate : boolean;

    @Marker() $payloadDescriptorEnd;
    @Marker() $payloadMark;

    @Field((i : Packet) => i.payload?.length ?? (i.userDataCount - i.measure(i => i.$userDataStart, i => i.$payloadMark) / 10), {
        serializer: new ST291.Serializer(),
        buffer: { truncate: false }
    }) 
    payload : Buffer | Uint8Array;

    static async depacketize(packets : Packet[]) {
        let buf = Buffer.concat(packets.map(x => x.payload));
        return await SCTE104.elements.Message.deserialize(buf);
    }

    static packetize(message : SCTE104.elements.Message, options? : PacketizationOptions): Packet[] {
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
                    following: sent + size < payload.length,
                    duplicate: options?.duplicate || false,
                    payload: payload.slice(sent, sent + size),
                }
            ));

            sent += size;
        }

        return packets;
    }
}

