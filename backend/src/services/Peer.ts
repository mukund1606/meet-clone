// import { DtlsParameters } from 'mediasoup/node/lib/fbs/web-rtc-transport';
import {
	Consumer,
	DtlsParameters,
	MediaKind,
	Producer,
	RtpCapabilities,
	RtpParameters,
	Transport,
} from 'mediasoup/node/lib/types';
import { logger } from '../logger';

interface CustomProducer extends Producer {
	isScreenShare: boolean;
}

export default class Peer {
	id: string;
	name: string;
	private isAdmin: boolean;
	private transports: Map<string, Transport>;
	private producers: Map<string, CustomProducer>;
	private consumers: Map<string, Consumer>;

	constructor(id: string, name: string, isAdmin: boolean) {
		this.id = id;
		this.name = name;
		this.isAdmin = isAdmin;
		this.transports = new Map();
		this.producers = new Map();
		this.consumers = new Map();
	}

	isPeerAdmin(): boolean {
		return this.isAdmin;
	}

	addTransport(transport: Transport): void {
		this.transports.set(transport.id, transport);
	}

	async connectTransport(transportId: string, dtlsParameters: DtlsParameters) {
		const transport = this.transports.get(transportId);
		if (!transport) {
			logger('ERROR', "Couldn't find transport");
			return;
		}
		await transport.connect({ dtlsParameters });
	}

	async createProducer(
		producerTransportId: string,
		rtpParameters: RtpParameters,
		kind: MediaKind,
		isScreenShare: boolean
	) {
		let producer = await this.transports.get(producerTransportId)?.produce({
			kind,
			rtpParameters,
		})!;

		const customProducer = producer as CustomProducer;
		customProducer.isScreenShare = isScreenShare;

		this.producers.set(producer?.id, customProducer);

		producer.on('transportclose', () => {
			logger('Producer Closed', { producer: producer.id });
			producer.close();
			this.producers.delete(producer.id);
		});

		return producer;
	}

	async createConsumer(
		consumer_transport_id: string,
		producer_id: string,
		rtpCapabilities: RtpCapabilities
	) {
		let consumerTransport = this.transports.get(consumer_transport_id);
		if (!consumerTransport) {
			console.warn('Create a transport for the specified consumer first ');
			return;
		}

		let consumer: Consumer;

		try {
			consumer = await consumerTransport.consume({
				producerId: producer_id,
				rtpCapabilities,
				paused: false,
			});
		} catch (error) {
			console.error('Consume failed', error);
			return;
		}

		if (consumer.type === 'simulcast') {
			await consumer.setPreferredLayers({
				spatialLayer: 2,
				temporalLayer: 2,
			});
		}

		this.consumers.set(consumer.id, consumer);

		consumer.on('transportclose', () => {
			console.log('Consumer transport close', {
				name: `${this.name}`,
				consumer_id: `${consumer.id}`,
			});
			this.consumers.delete(consumer.id);
		});

		return {
			consumer,
			user: {
				id: this.id,
				name: this.name,
			},
			params: {
				producerId: producer_id,
				id: consumer.id,
				kind: consumer.kind,
				rtpParameters: consumer.rtpParameters,
				type: consumer.type,
				producerPaused: consumer.producerPaused,
			},
		};
	}
	closeProducer(producer_id: string) {
		console.log(this.producers);

		try {
			this.producers.get(producer_id)!.close();
		} catch (e) {
			console.warn(e);
		}

		this.producers.delete(producer_id);
	}

	getProducer(producer_id: string) {
		return this.producers.get(producer_id);
	}

	close() {
		this.transports.forEach((transport) => transport.close());
	}

	removeConsumer(consumerId: string) {
		this.consumers.delete(consumerId);
	}

	get producers_() {
		return this.producers;
	}
}
