import { describe } from "razmin";
import { expect } from "chai";
import * as ST2010 from "./syntax";
import * as ST291 from "@astronautlabs/st291";
import * as SCTE104 from "@astronautlabs/scte104";

describe("Packet", it => {
    it('parses a simple sample (1)', async () => {
        let buf = Buffer.from([
            0xFF, 0x24, 0x14, 0x1E, 0x07, 
            0xBA, 0x10, 0x14, 0x0A, 0x03, 
            0x41, 0x20, 0x58, 0x19, 0x4C
        ]);

        let packet = await ST2010.Packet.deserialize(buf);

        expect(packet.continued).to.be.false;
        expect(packet.following).to.be.false;
        expect(packet.duplicate).to.be.false;
        expect(packet.payload.length).to.equal(6);
        expect(Array.from(packet.payload)).to.eql([1,2,3,4,5,6]);
    });
    it('parses a simple sample (2)', async () => {
        let buf = Buffer.from([
            0xFF, 0x24, 0x14, 0x1E, 0x07, 
            0xBA, 0x20, 0x68, 0x15, 0x04, 
            0x80, 0xD0, 0x24, 0x05, 0x4C
        ]);

        let packet = await ST2010.Packet.deserialize(buf);

        expect(packet.continued).to.be.false;
        expect(packet.following).to.be.false;
        expect(packet.duplicate).to.be.false;
        expect(packet.payload.length).to.equal(6);
        expect(Array.from(packet.payload)).to.eql([6,5,4,3,2,1]);
    });

    it('notices the presence of the duplicate flag', async () => {
        let buf = Buffer.from([
            0xff, 0x24, 0x14, 0x1e, 0x07, 
            0x7a, 0x50, 0x14, 0x0a, 0x03, 
            0x41, 0x20, 0x58, 0x1a, 0x4d
        ]);

        let packet = await ST2010.Packet.deserialize(buf);

        expect(packet.continued).to.be.false;
        expect(packet.following).to.be.false;
        expect(packet.duplicate).to.be.true;
        expect(packet.payload.length).to.equal(6);
        expect(Array.from(packet.payload)).to.eql([1,2,3,4,5,6]);

    });

    it('participates in ST291 variation', async () => {
        let buf = Buffer.from([
            0xff, 0x24, 0x14, 0x1e, 0x07, 
            0x7a, 0x50, 0x14, 0x0a, 0x03, 
            0x41, 0x20, 0x58, 0x1a, 0x4d
        ]);

        expect(await ST291.Packet.deserialize(buf))
            .to.be.instanceOf(ST2010.Packet);
    });

    it('produces the expected binary when serializing', async () => {
        let buf = Buffer.from([
            0xFF, 0x24, 0x14, 0x1E, 0x07, 
            0x7A, 0x50, 0x14, 0x0A, 0x03, 
            0x41, 0x20, 0x58, 0x1A, 0x4D
        ]);

        let packet = new ST2010.Packet();
        packet.continued = false;
        packet.duplicate = true;
        packet.following = false;
        packet.payload = Buffer.from([1,2,3,4,5,6]);

        let serialized = packet.serialize();
        expect(serialized).to.eql(buf);
    });

    it('properly deserializes a MultipleOperationMessage', async () => {
        let buf = Buffer.from([
            0xFF, 0x24, 0x14, 0x1E, 0x27, 0xBA, 0x2F, 0xFB, 
            0xFE, 0x00, 0x49, 0xA0, 0x08, 0x01, 0x01, 0x80, 
            0x20, 0x08, 0x01, 0x01, 0x98, 0x26, 0x07, 0x69, 
            0xC8, 0x80, 0x20, 0x08, 0x02, 0x00, 0x40, 0x50, 
            0x14, 0x06, 0x00, 0x43, 0x90, 0x19, 0x82, 0x60, 
            0x76, 0x9C, 0x89, 0x5A, 0xC3, 0x83, 0xEA, 0x08, 
            0x26, 0x60, 0x80, 0x20, 0x04, 0x06, 0x85
        ]);

        let packet = await ST2010.Packet.deserialize(buf);
        expect(packet.payload.length).to.equal(38);

        let message = await ST2010.Packet.depacketize([packet]);
        expect(message.opID).to.equal(SCTE104.MULTIPLE_OPERATION_INDICATOR);
        expect(message).to.be.instanceOf(SCTE104.elements.MultipleOperationMessage);
        if (message instanceof SCTE104.elements.MultipleOperationMessage) {
            expect(message.protocolVersion).to.equal(0);
            expect(message.asIndex).to.equal(0);
            expect(message.dpiPidIndex).to.equal(0);
            expect(message.scte35ProtocolVersion).to.equal(0);
            expect(message.operations.length).to.equal(1);

            let op = message.operations[0];
            expect(op.opID).to.equal(SCTE104.MOP.SPLICE);
            expect(op.dataLength).to.equal(14);
            expect(op).to.be.instanceOf(SCTE104.elements.SpliceRequest);
            if (op instanceof SCTE104.elements.SpliceRequest) {
                expect(op.spliceInsertType).to.equal(SCTE104.SPLICE_START_NORMAL);
                expect(op.spliceEventId).to.equal(1616960200);
                expect(op.uniqueProgramId).to.equal(22211);
                expect(op.preRollTime).to.equal(4000);
                expect(op.breakDuration).to.equal(2400);
                expect(op.availNum).to.equal(0);
                expect(op.availsExpected).to.equal(0);
                expect(op.autoReturnFlag).to.equal(1);
            }

            expect(message.messageNumber).to.equal(1);
            expect(message.messageSize).to.equal(38);
            expect(message.timestamp).to.be.instanceOf(SCTE104.elements.UtcTimestamp);
            expect(message.timestamp.timeType).to.equal(SCTE104.TIME_TYPE_UTC);

            if (message.timestamp instanceof SCTE104.elements.UtcTimestamp) {
                expect(message.timestamp.seconds).to.equal(1616960200);
                expect(message.timestamp.microseconds).to.equal(0);
            }
        }
    });

    it('properly serializes a MultipleOperationMessage', async () => {
        let buf = Buffer.from([
            0xFF, 0x24, 0x14, 0x1E, 0x27, 0xBA, 0x2F, 0xFB, 
            0xFE, 0x00, 0x49, 0xA0, 0x08, 0x01, 0x01, 0x80, 
            0x20, 0x08, 0x01, 0x01, 0x98, 0x26, 0x07, 0x69, 
            0xC8, 0x80, 0x20, 0x08, 0x02, 0x00, 0x40, 0x50, 
            0x14, 0x06, 0x00, 0x43, 0x90, 0x19, 0x82, 0x60, 
            0x76, 0x9C, 0x89, 0x5A, 0xC3, 0x83, 0xEA, 0x08, 
            0x26, 0x60, 0x80, 0x20, 0x04, 0x06, 0x85
        ]);

        let packet = new ST2010.Packet();
        packet.continued = false;
        packet.following = false;
        packet.duplicate = false;

        let message = new SCTE104.elements.MultipleOperationMessage();
        message.messageNumber = 1;

        let splice = new SCTE104.elements.SpliceRequest();
        splice.opID = SCTE104.MOP.SPLICE;
        splice.spliceInsertType = SCTE104.SPLICE_START_NORMAL;
        splice.spliceEventId = 1616960200;
        splice.uniqueProgramId = 22211;
        splice.preRollTime = 4000;
        splice.breakDuration = 2400;
        splice.availNum = 0;
        splice.availsExpected = 0;
        splice.autoReturnFlag = 1;

        let timestamp = new SCTE104.elements.UtcTimestamp();
        timestamp.seconds = 1616960200;
        timestamp.microseconds = 0;

        message.timestamp = timestamp;
        message.operations = [
            splice
        ];
        packet.payload = message.serialize();

        let serializedBuf = packet.serialize();

        expect(serializedBuf).to.eql(buf);
    });
});