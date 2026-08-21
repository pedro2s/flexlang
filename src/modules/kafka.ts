import { NATIVE_TAG, type NativeModule } from "./types";
import { optionNone, optionSome, resultErr, resultOk } from "../stdlib";
import type { Interpreter } from "../interpreter";

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function getField<T>(obj: any, key: string, defaultValue: T): T {
  if (!obj) return defaultValue;
  if (obj instanceof Map) {
    const val = obj.get(key);
    return val !== undefined ? (val as T) : defaultValue;
  }
  if (typeof obj === "object" && key in obj) {
    const val = obj[key];
    return val !== undefined ? (val as T) : defaultValue;
  }
  return defaultValue;
}

function toMap(obj: any): Map<string, string> {
  const m = new Map<string, string>();
  if (!obj) return m;
  if (obj instanceof Map) {
    for (const [k, v] of obj.entries()) {
      if (k !== undefined && v !== undefined) {
        m.set(String(k), String(v));
      }
    }
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        m.set(String(k), String(v));
      }
    }
  }
  return m;
}

export interface InternalKafkaMessage {
  key: string;
  value: string;
  headers: Map<string, string>;
  topic: string;
  partition: number;
  offset: number;
}

class EventBroker {
  private static instance = new EventBroker();
  static get(): EventBroker {
    return EventBroker.instance;
  }

  private topicPartitions = new Map<string, InternalKafkaMessage[]>();
  private groupOffsets = new Map<string, number>();
  private numPartitions = 3;

  reset(): void {
    this.topicPartitions.clear();
    this.groupOffsets.clear();
  }

  publish(topic: string, key: string, value: string, headers: Map<string, string>): InternalKafkaMessage {
    let list = this.topicPartitions.get(topic);
    if (!list) {
      list = [];
      this.topicPartitions.set(topic, list);
    }
    const partition = key.length > 0 ? hashString(key) % this.numPartitions : 0;
    const offset = list.length;
    const msg: InternalKafkaMessage = {
      key,
      value,
      headers,
      topic,
      partition,
      offset,
    };
    list.push(msg);
    return msg;
  }

  getMessages(topic: string, groupId: string): InternalKafkaMessage[] {
    const list = this.topicPartitions.get(topic) ?? [];
    const offsetKey = `${groupId}:${topic}`;
    const currentOffset = this.groupOffsets.get(offsetKey) ?? 0;
    if (currentOffset >= list.length) {
      return [];
    }
    return list.slice(currentOffset);
  }

  commitOffset(topic: string, groupId: string, offset: number): void {
    const offsetKey = `${groupId}:${topic}`;
    this.groupOffsets.set(offsetKey, offset + 1);
  }
}

export class FlexProducer {
  readonly [NATIVE_TAG] = "Producer";
  private brokers: string[];
  private clientId: string;
  private acks: string;
  private isClosed = false;

  constructor(config: any) {
    this.brokers = getField(config, "brokers", ["localhost:9092"]);
    this.clientId = getField(config, "client_id", "flex-producer");
    this.acks = getField(config, "acks", "all");
  }

  publish(topic: string, message: any): unknown {
    if (this.isClosed) {
      return resultErr("producer is closed");
    }
    if (!topic || topic.trim().length === 0) {
      return resultErr("topic cannot be empty");
    }
    const key = getField(message, "key", "");
    const value = getField(message, "value", "");
    const rawHeaders = getField(message, "headers", new Map());
    const headers = toMap(rawHeaders);

    EventBroker.get().publish(topic, key, value, headers);
    return resultOk(null);
  }

  publish_batch(topic: string, messages: any[]): unknown {
    if (this.isClosed) {
      return resultErr("producer is closed");
    }
    if (!topic || topic.trim().length === 0) {
      return resultErr("topic cannot be empty");
    }
    if (!Array.isArray(messages)) {
      return resultErr("messages must be an array");
    }
    for (const message of messages) {
      const key = getField(message, "key", "");
      const value = getField(message, "value", "");
      const rawHeaders = getField(message, "headers", new Map());
      const headers = toMap(rawHeaders);
      EventBroker.get().publish(topic, key, value, headers);
    }
    return resultOk(null);
  }

  close(): unknown {
    this.isClosed = true;
    return resultOk(null);
  }
}

export class FlexConsumer {
  readonly [NATIVE_TAG] = "Consumer";
  private brokers: string[];
  private groupId: string;
  private clientId: string;
  private subscribedTopics: string[] = [];
  private isClosed = false;

  constructor(
    config: any,
    private interpreter: Interpreter,
  ) {
    this.brokers = getField(config, "brokers", ["localhost:9092"]);
    this.groupId = getField(config, "group_id", "flex-consumer-group");
    this.clientId = getField(config, "client_id", "flex-consumer");
  }

  subscribe(topics: string[]): unknown {
    if (this.isClosed) {
      return resultErr("consumer is closed");
    }
    if (!Array.isArray(topics) || topics.length === 0) {
      return resultErr("topics must be a non-empty array");
    }
    for (const t of topics) {
      if (!this.subscribedTopics.includes(t)) {
        this.subscribedTopics.push(t);
      }
    }
    return resultOk(null);
  }

  async listen(handler: unknown): Promise<unknown> {
    if (this.isClosed) {
      return resultErr("consumer is closed");
    }
    if (this.subscribedTopics.length === 0) {
      return resultErr("consumer has no subscribed topics");
    }

    const broker = EventBroker.get();
    for (const topic of this.subscribedTopics) {
      const pending = broker.getMessages(topic, this.groupId);
      for (const msg of pending) {
        const msgMap = new Map<string, unknown>();
        msgMap.set("key", msg.key);
        msgMap.set("value", msg.value);
        msgMap.set("headers", msg.headers);
        msgMap.set("topic", msg.topic);
        msgMap.set("partition", msg.partition);
        msgMap.set("offset", msg.offset);

        try {
          const res = await this.interpreter.callFunction(handler, [msgMap]);
          if (res && typeof res === "object") {
            const obj = res as any;
            if (obj.kind === "EnumVariant" && obj.variantName === "Err") {
              return res;
            }
          }
          broker.commitOffset(topic, this.groupId, msg.offset);
        } catch (e: any) {
          return resultErr(e.message ?? String(e));
        }
      }
    }

    return resultOk(null);
  }

  poll(timeoutMs?: number): unknown {
    if (this.isClosed) {
      return resultErr("consumer is closed");
    }
    if (this.subscribedTopics.length === 0) {
      return resultErr("consumer has no subscribed topics");
    }

    const broker = EventBroker.get();
    const resultMessages: Map<string, unknown>[] = [];
    for (const topic of this.subscribedTopics) {
      const pending = broker.getMessages(topic, this.groupId);
      for (const msg of pending) {
        const msgMap = new Map<string, unknown>();
        msgMap.set("key", msg.key);
        msgMap.set("value", msg.value);
        msgMap.set("headers", msg.headers);
        msgMap.set("topic", msg.topic);
        msgMap.set("partition", msg.partition);
        msgMap.set("offset", msg.offset);
        resultMessages.push(msgMap);
        broker.commitOffset(topic, this.groupId, msg.offset);
      }
    }

    return resultOk(resultMessages);
  }

  close(): unknown {
    this.isClosed = true;
    return resultOk(null);
  }
}

const GO_BOILERPLATE = `// --- FlexLang mq/kafka & mq/events (RFC-040) ---
type KafkaConfig struct {
	brokers    any
	client_id  string
	group_id   string
	acks       string
	timeout_ms int
}

type EventMessage struct {
	key       string
	value     string
	headers   any
	topic     string
	partition int
	offset    int
}

type internalGoMessage struct {
	key       string
	value     string
	headers   map[string]string
	topic     string
	partition int
	offset    int
}

var (
	kafkaMu        sync.RWMutex
	kafkaBrokerMsg = make(map[string][]internalGoMessage)
	kafkaOffsets   = make(map[string]int)
)

func kafkaHash(str string) int {
	h := fnv.New32a()
	h.Write([]byte(str))
	v := int(h.Sum32())
	if v < 0 {
		return -v
	}
	return v
}

func kafkaGetBrokers(b any) []string {
	var res []string
	if b == nil {
		return res
	}
	switch v := b.(type) {
	case []string:
		return v
	case []any:
		for _, item := range v {
			res = append(res, fmt.Sprintf("%v", item))
		}
	}
	return res
}

func kafkaGetHeaders(h any) map[string]string {
	res := make(map[string]string)
	if h == nil {
		return res
	}
	switch m := h.(type) {
	case map[string]string:
		for k, v := range m {
			res[k] = v
		}
	case map[string]any:
		for k, v := range m {
			res[k] = fmt.Sprintf("%v", v)
		}
	}
	return res
}

type Producer struct {
	config   *KafkaConfig
	isClosed bool
}

func Producer_new(config *KafkaConfig) Result {
	if config == nil {
		return Result_Err_new("kafka config cannot be nil")
	}
	brokers := kafkaGetBrokers(config.brokers)
	if len(brokers) == 0 {
		return Result_Err_new("kafka brokers list cannot be empty")
	}
	return Result_Ok_new(&Producer{config: config})
}

func NewProducer(config *KafkaConfig) Result {
	return Producer_new(config)
}

func (p *Producer) publish(topic string, message *EventMessage) Result {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()

	if p.isClosed {
		return Result_Err_new("producer is closed")
	}
	if len(topic) == 0 {
		return Result_Err_new("topic cannot be empty")
	}
	if message == nil {
		return Result_Err_new("message cannot be nil")
	}

	key := message.key
	partition := 0
	if len(key) > 0 {
		partition = kafkaHash(key) % 3
	}

	list := kafkaBrokerMsg[topic]
	offset := len(list)
	headers := kafkaGetHeaders(message.headers)

	msg := internalGoMessage{
		key:       key,
		value:     message.value,
		headers:   headers,
		topic:     topic,
		partition: partition,
		offset:    offset,
	}

	kafkaBrokerMsg[topic] = append(list, msg)
	return Result_Ok_new(nil)
}

func (p *Producer) publish_batch(topic string, messages any) Result {
	var msgList []*EventMessage
	switch ms := messages.(type) {
	case []*EventMessage:
		msgList = ms
	case []EventMessage:
		for i := range ms {
			msgList = append(msgList, &ms[i])
		}
	case []any:
		for _, item := range ms {
			if m, ok := item.(*EventMessage); ok {
				msgList = append(msgList, m)
			} else if mVal, ok := item.(EventMessage); ok {
				msgList = append(msgList, &mVal)
			}
		}
	}

	for _, m := range msgList {
		res := p.publish(topic, m)
		if _, ok := res.(Result_Err); ok {
			return res
		}
	}
	return Result_Ok_new(nil)
}

func (p *Producer) close() Result {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()
	p.isClosed = true
	return Result_Ok_new(nil)
}

type Consumer struct {
	config           *KafkaConfig
	subscribedTopics []string
	isClosed         bool
}

func Consumer_new(config *KafkaConfig) Result {
	if config == nil {
		return Result_Err_new("kafka config cannot be nil")
	}
	brokers := kafkaGetBrokers(config.brokers)
	if len(brokers) == 0 {
		return Result_Err_new("kafka brokers list cannot be empty")
	}
	if len(config.group_id) == 0 {
		return Result_Err_new("consumer group_id is required")
	}
	return Result_Ok_new(&Consumer{
		config:           config,
		subscribedTopics: make([]string, 0),
	})
}

func NewConsumer(config *KafkaConfig) Result {
	return Consumer_new(config)
}

func (c *Consumer) subscribe(topics any) Result {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()

	if c.isClosed {
		return Result_Err_new("consumer is closed")
	}

	var topicList []string
	switch ts := topics.(type) {
	case []string:
		topicList = ts
	case []any:
		for _, item := range ts {
			topicList = append(topicList, fmt.Sprintf("%v", item))
		}
	}

	if len(topicList) == 0 {
		return Result_Err_new("topics list cannot be empty")
	}
	for _, t := range topicList {
		exists := false
		for _, sub := range c.subscribedTopics {
			if sub == t {
				exists = true
				break
			}
		}
		if !exists {
			c.subscribedTopics = append(c.subscribedTopics, t)
		}
	}
	return Result_Ok_new(nil)
}

func (c *Consumer) listen(handler any) Result {
	kafkaMu.Lock()
	if c.isClosed {
		kafkaMu.Unlock()
		return Result_Err_new("consumer is closed")
	}
	if len(c.subscribedTopics) == 0 {
		kafkaMu.Unlock()
		return Result_Err_new("consumer has no subscribed topics")
	}

	type itemToProcess struct {
		topic string
		msg   *EventMessage
	}

	var toProcess []itemToProcess
	groupId := c.config.group_id

	for _, topic := range c.subscribedTopics {
		list := kafkaBrokerMsg[topic]
		offsetKey := fmt.Sprintf("%s:%s", groupId, topic)
		curOffset := kafkaOffsets[offsetKey]
		if curOffset < len(list) {
			for i := curOffset; i < len(list); i++ {
				m := list[i]
				msgObj := &EventMessage{
					key:       m.key,
					value:     m.value,
					headers:   m.headers,
					topic:     m.topic,
					partition: m.partition,
					offset:    m.offset,
				}
				toProcess = append(toProcess, itemToProcess{topic: topic, msg: msgObj})
			}
		}
	}
	kafkaMu.Unlock()

	var fn func(*EventMessage) Result
	switch h := handler.(type) {
	case func(*EventMessage) Result:
		fn = h
	case func(any) Result:
		fn = func(m *EventMessage) Result {
			return h(m)
		}
	default:
		return Result_Err_new("invalid handler function")
	}

	for _, item := range toProcess {
		res := fn(item.msg)
		if _, ok := res.(Result_Err); ok {
			return res
		}
		kafkaMu.Lock()
		offsetKey := fmt.Sprintf("%s:%s", groupId, item.topic)
		kafkaOffsets[offsetKey] = item.msg.offset + 1
		kafkaMu.Unlock()
	}

	return Result_Ok_new(nil)
}

func (c *Consumer) poll(args ...int) Result {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()

	if c.isClosed {
		return Result_Err_new("consumer is closed")
	}
	if len(c.subscribedTopics) == 0 {
		return Result_Err_new("consumer has no subscribed topics")
	}

	var resultList []*EventMessage
	groupId := c.config.group_id

	for _, topic := range c.subscribedTopics {
		list := kafkaBrokerMsg[topic]
		offsetKey := fmt.Sprintf("%s:%s", groupId, topic)
		curOffset := kafkaOffsets[offsetKey]
		if curOffset < len(list) {
			for i := curOffset; i < len(list); i++ {
				m := list[i]
				msgObj := &EventMessage{
					key:       m.key,
					value:     m.value,
					headers:   m.headers,
					topic:     m.topic,
					partition: m.partition,
					offset:    m.offset,
				}
				resultList = append(resultList, msgObj)
				kafkaOffsets[offsetKey] = m.offset + 1
			}
		}
	}

	return Result_Ok_new(resultList)
}

func (c *Consumer) close() Result {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()
	c.isClosed = true
	return Result_Ok_new(nil)
}
// ---------------------------------------------`;

export const kafkaModule: NativeModule = {
  path: "mq/kafka",

  types: [
    {
      name: "KafkaConfig",
      goPointer: true,
      properties: [
        {
          name: "brokers",
          typeAnnotation: {
            kind: "ArrayTypeNode",
            elementType: { kind: "NamedTypeNode", name: "String" },
          },
        },
        { name: "client_id", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "group_id", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "acks", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "timeout_ms", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    {
      name: "EventMessage",
      goPointer: true,
      properties: [
        { name: "key", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "value", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        {
          name: "headers",
          typeAnnotation: {
            kind: "HashMapTypeNode",
            keyType: { kind: "NamedTypeNode", name: "String" },
            valueType: { kind: "NamedTypeNode", name: "String" },
          },
        },
        { name: "topic", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "partition", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "offset", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    {
      name: "Producer",
      goPointer: true,
      statics: [
        {
          name: "new",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [
              { kind: "Struct", name: "Producer", genericArgs: [] },
              { kind: "String" },
            ],
          },
        },
      ],
      methods: [
        {
          name: "publish",
          arity: 2,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Void" }, { kind: "String" }],
          },
        },
        {
          name: "publish_batch",
          arity: 2,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Void" }, { kind: "String" }],
          },
        },
        {
          name: "close",
          arity: 0,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Void" }, { kind: "String" }],
          },
        },
      ],
    },
    {
      name: "Consumer",
      goPointer: true,
      statics: [
        {
          name: "new",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [
              { kind: "Struct", name: "Consumer", genericArgs: [] },
              { kind: "String" },
            ],
          },
        },
      ],
      methods: [
        {
          name: "subscribe",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Void" }, { kind: "String" }],
          },
        },
        {
          name: "listen",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Void" }, { kind: "String" }],
          },
        },
        {
          name: "poll",
          minArity: 0,
          maxArity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [
              {
                kind: "Array",
                elementType: { kind: "Struct", name: "EventMessage", genericArgs: [] },
              },
              { kind: "String" },
            ],
          },
        },
        {
          name: "close",
          arity: 0,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Void" }, { kind: "String" }],
          },
        },
      ],
    },
  ],

  usesBuiltins: ["Result", "Option"],

  runtimeBinding: (interpreter: Interpreter) => ({
    KafkaConfig: {
      kind: "StructDeclaration",
      name: "KafkaConfig",
      properties: [
        {
          name: "brokers",
          typeAnnotation: {
            kind: "ArrayTypeNode",
            elementType: { kind: "NamedTypeNode", name: "String" },
          },
        },
        { name: "client_id", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "group_id", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "acks", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "timeout_ms", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    EventMessage: {
      kind: "StructDeclaration",
      name: "EventMessage",
      properties: [
        { name: "key", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "value", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        {
          name: "headers",
          typeAnnotation: {
            kind: "HashMapTypeNode",
            keyType: { kind: "NamedTypeNode", name: "String" },
            valueType: { kind: "NamedTypeNode", name: "String" },
          },
        },
        { name: "topic", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "partition", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "offset", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    Producer: {
      [NATIVE_TAG]: "Producer",
      new: (config: any) => {
        const brokers = getField<string[]>(config, "brokers", []);
        if (!brokers || brokers.length === 0) {
          return resultErr("kafka brokers list cannot be empty");
        }
        return resultOk(new FlexProducer(config));
      },
    },
    Consumer: {
      [NATIVE_TAG]: "Consumer",
      new: (config: any) => {
        const brokers = getField<string[]>(config, "brokers", []);
        if (!brokers || brokers.length === 0) {
          return resultErr("kafka brokers list cannot be empty");
        }
        const groupId = getField(config, "group_id", "");
        if (!groupId || groupId.length === 0) {
          return resultErr("consumer group_id is required");
        }
        return resultOk(new FlexConsumer(config, interpreter));
      },
    },
  }),

  goCodegen: {
    imports: ["fmt", "hash/fnv", "sync"],
    boilerplate: GO_BOILERPLATE,
  },
};

export const eventsModule: NativeModule = {
  ...kafkaModule,
  path: "mq/events",
};
